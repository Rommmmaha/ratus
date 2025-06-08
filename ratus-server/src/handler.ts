// Message structure for type safety

import { ConnectionManager, type WebSocketData } from "./connection_manager.ts";
import { log } from "./log.ts";

/**
 * Enum for all supported message types.
 */
enum MessageType {
  LOGIN = "login",
  LOGOUT = "logout",
  LIST = "list",
  MOUSE = "mouse",
  KEY = "key",
  SELECT_USER = "select_user",
  UNSELECT_USER = "unselect_user",
  FRAME = "frame",
  USER_CONNECTED = "user_connected",
  USER_DISCONNECTED = "user_disconnected",
  ERROR = "error",
  STREAM_START = "stream_start",
  STREAM_STOP = "stream_stop",
}

/**
 * Type for all possible messages handled by the server.
 */
type Message = { type: MessageType.LOGIN; role: string; passkey?: string } | { type: MessageType.LOGOUT } | { type: MessageType.LIST } | { type: MessageType.MOUSE; action: string; key?: string; x?: number; y?: number } | { type: MessageType.KEY; keycode: string; action: string } | { type: MessageType.SELECT_USER; user: string } | { type: MessageType.UNSELECT_USER } | { type: MessageType.FRAME; mouse?: unknown; data: unknown } | { type: MessageType.USER_CONNECTED; user: string } | { type: MessageType.USER_DISCONNECTED; user: string } | { type: MessageType.ERROR; message: string } | { type: MessageType.STREAM_START } | { type: MessageType.STREAM_STOP } | { type: string; [key: string]: unknown }; // fallback for unknown types

/**
 * Utility: Truncate long strings in objects for logging.
 */
function truncateLongStrings(obj: unknown, maxLength = 100): unknown {
  if (typeof obj === "string" && obj.length > maxLength) {
    return "<too_long>";
  }
  if (typeof obj === "object" && obj !== null) {
    if (Array.isArray(obj)) {
      return obj.map((item) => truncateLongStrings(item, maxLength));
    } else {
      const newObj: Record<string, unknown> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          newObj[key] = truncateLongStrings((obj as Record<string, unknown>)[key], maxLength);
        }
      }
      return newObj;
    }
  }
  return obj;
}

interface UserWebSocketData extends WebSocketData {
  selectedByAdmins?: Set<string>;
}

interface AdminWebSocketData extends WebSocketData {
  selectedUser?: string;
}

/**
 * Handles all WebSocket packets and manages admin/user connections.
 */
export class PacketsHandler {
  private admins = new ConnectionManager();
  private users = new ConnectionManager();
  private adminPasskeys: Set<string> = new Set();

  constructor(passkeysFile = "passkeys.json") {
    // Load passkeys from file asynchronously at startup
    try {
      const file = Bun.file(passkeysFile);
      file.text().then((text: string) => {
        try {
          const keys = JSON.parse(text);
          if (Array.isArray(keys)) {
            this.adminPasskeys = new Set(keys);
          }
        } catch (e) {
          log("$E", `Failed to parse passkeys.json: ${e}`);
        }
      });
    } catch (e) {
      log("$E", `Failed to load passkeys.json: ${e}`);
    }
  }

  /**
   * Main message handler for all WebSocket messages.
   */
  public handleMessage(ws: Bun.ServerWebSocket<WebSocketData>, message: string): void {
    try {
      const msg: Message = JSON.parse(message.toString());
      const msgForLog = truncateLongStrings(structuredClone(msg));
      log("$M", `${ws.remoteAddress}: ${JSON.stringify(msgForLog)}`);

      switch (msg.type) {
        case MessageType.LOGIN:
          this.handleLogin(ws, msg);
          break;
        case MessageType.LOGOUT:
          this.handleLogout(ws);
          break;
        default:
          if (this.admins.getByUuid(ws.data.uuid)) {
            this.handleAdminMessage(ws, msg);
          } else if (this.users.getByUuid(ws.data.uuid)) {
            this.handleUserMessage(ws, msg);
          }
          break;
      }
    } catch (error) {
      log("$M", `${ws.remoteAddress}: ${message}`);
      log("$E", error);
      ws.send(JSON.stringify({ type: MessageType.ERROR, message: "error" }));
    }
  }

  /**
   * Handles login for both admin and user roles.
   */
  private handleLogin(ws: Bun.ServerWebSocket<WebSocketData>, msg: Message): void {
    if (ws.data !== undefined) {
      ws.send(JSON.stringify({ type: MessageType.ERROR, message: "You are already logged in" }));
      return;
    }
    if (msg.type === MessageType.LOGIN && "role" in msg) {
      if (msg.role === "admin") {
        if ("passkey" in msg && typeof msg.passkey === "string" && this.adminPasskeys.has(msg.passkey)) {
          this.admins.connect(ws);
          log("LCA", ws.remoteAddress);
        } else {
          ws.send(JSON.stringify({ type: MessageType.ERROR, message: "Wrong passkey" }));
          log("LE", `${ws.remoteAddress}\tWrong passkey:${"passkey" in msg ? msg.passkey : ""}`);
          return;
        }
      } else if (msg.role === "user") {
        this.users.connect(ws);
        (ws.data as UserWebSocketData).selectedByAdmins = new Set();
        log("LCU", ws.remoteAddress);
        this.admins.getSockets().forEach((admin) => {
          admin.send(JSON.stringify({ type: MessageType.USER_CONNECTED, user: ws.data.uuid }));
        });
      }
    }
  }

  /**
   * Handles logout for both admin and user roles.
   */
  public handleLogout(ws: Bun.ServerWebSocket<WebSocketData>): void {
    if (!ws.data || !ws.data.uuid) return;
    if (this.admins.getByUuid(ws.data.uuid)) {
      // Remove this admin from all users' selectedByAdmins sets
      this.users.getSockets().forEach((userWs) => {
        const userData = userWs.data as UserWebSocketData;
        userData.selectedByAdmins?.delete(ws.data.uuid);
      });
      this.admins.disconnectBySocket(ws);
      log("LDA", ws.remoteAddress);
    }
    if (this.users.getByUuid(ws.data.uuid)) {
      this.users.disconnectBySocket(ws);
      log("LDU", ws.remoteAddress);
      this.admins.getSockets().forEach((admin) => {
        admin.send(JSON.stringify({ type: MessageType.USER_DISCONNECTED, user: ws.data.uuid }));
      });
    }
  }

  /**
   * Handles messages from admin clients.
   */
  private handleAdminMessage(ws: Bun.ServerWebSocket<WebSocketData>, msg: Message): void {
    const adminData = ws.data as AdminWebSocketData;
    switch (msg.type) {
      case MessageType.LIST: {
        const usersList: string[] = Array.from(this.users.getSockets()).map((user) => user.data.uuid);
        ws.send(JSON.stringify({ type: MessageType.LIST, users: usersList }));
        break;
      }
      case MessageType.MOUSE: {
        if (adminData.selectedUser && "action" in msg) {
          const userWs = this.users.getByUuid(adminData.selectedUser);
          userWs?.send(JSON.stringify({ type: MessageType.MOUSE, action: msg.action, key: msg.key, x: msg.x, y: msg.y }));
        }
        break;
      }
      case MessageType.KEY: {
        if (adminData.selectedUser && "keycode" in msg && "action" in msg) {
          const userWs = this.users.getByUuid(adminData.selectedUser);
          userWs?.send(
            JSON.stringify({
              type: MessageType.KEY,
              keycode: msg.keycode,
              action: msg.action,
            })
          );
        }
        break;
      }
      case MessageType.SELECT_USER: {
        if ("user" in msg && typeof msg.user === "string") {
          // Unselect previous user if any
          if (adminData.selectedUser) {
            const prevUserWs = this.users.getByUuid(adminData.selectedUser);
            if (prevUserWs) {
              const prevUserData = prevUserWs.data as UserWebSocketData;
              prevUserData.selectedByAdmins?.delete(ws.data.uuid);
            }
          }
          // Select new user
          const userWs = this.users.getByUuid(msg.user);
          if (userWs) {
            const userData = userWs.data as UserWebSocketData;
            const wasEmpty = !userData.selectedByAdmins || userData.selectedByAdmins.size === 0;
            if (!userData.selectedByAdmins) userData.selectedByAdmins = new Set();
            userData.selectedByAdmins.add(ws.data.uuid);
            adminData.selectedUser = msg.user;
            if (wasEmpty) {
              userWs.send(JSON.stringify({ type: MessageType.STREAM_START }));
            }
          } else {
            ws.send(JSON.stringify({ type: MessageType.ERROR, message: "User not found" }));
          }
        }
        break;
      }
      case MessageType.UNSELECT_USER: {
        if (adminData.selectedUser) {
          const prevUserWs = this.users.getByUuid(adminData.selectedUser);
          if (prevUserWs) {
            const prevUserData = prevUserWs.data as UserWebSocketData;
            prevUserData.selectedByAdmins?.delete(ws.data.uuid);
          }
          adminData.selectedUser = undefined;
        }
        break;
      }
    }
  }

  /**
   * Handles messages from user clients.
   */
  private handleUserMessage(ws: Bun.ServerWebSocket<WebSocketData>, msg: Message): void {
    const userData = ws.data as UserWebSocketData;
    const selectedBy = userData.selectedByAdmins || new Set();
    switch (msg.type) {
      case MessageType.FRAME: {
        let sent = false;
        if ("data" in msg) {
          for (const adminUuid of selectedBy) {
            const adminWs = this.admins.getByUuid(adminUuid);
            if (adminWs) {
              adminWs.send(JSON.stringify({ type: MessageType.FRAME, mouse: msg.mouse, data: msg.data }));
              sent = true;
            }
          }
        }
        if (!sent) {
          ws.send(JSON.stringify({ type: MessageType.STREAM_STOP }));
        }
        break;
      }
    }
  }
}

import { useActiveUserStore } from "@/stores/activeUserStore";
import { useAllUsersStore } from "@/stores/allUsersStore";
import type { User } from "@/types";

const WS_URL = `ws://${window.location.hostname}:5555`;

/**
 * WebSocketClient handles the websocket connection and message routing for the admin UI.
 */
class WebSocketClient {
  private ws: WebSocket | null = null;
  private onWrongPasskey: (() => void) | null = null;

  /**
   * Set a handler for wrong passkey events.
   */
  setWrongPasskeyHandler(handler: () => void) {
    this.onWrongPasskey = handler;
  }

  /**
   * Connect to the websocket server with an optional passkey.
   */
  connect(passkey = "") {
    this.ws = new WebSocket(WS_URL);
    this.ws.onopen = () => {
      this.send({
        type: "login",
        role: "admin",
        passkey,
      });
      setTimeout(() => {
        this.send({ type: "list" });
      }, 1000);
    };
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "error" && msg.message === "Wrong passkey" && this.onWrongPasskey) {
        this.onWrongPasskey();
      } else {
        this.handleMessage(msg);
      }
    };
    this.ws.onclose = () => {};
    this.ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }

  /**
   * Send a message to the websocket server.
   */
  send(data: Record<string, unknown>) {
    if (this.ws) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Handle incoming messages from the websocket server.
   */
  private handleMessage(msg: any) {
    const activeUserStore = useActiveUserStore();
    const allUsersStore = useAllUsersStore();

    switch (msg.type) {
      case "error":
        // Error already handled elsewhere
        break;
      case "list":
        allUsersStore.setUsers(
          msg.users.map((u: any) => {
            if (typeof u === "string") {
              return new UserImpl({ id: u });
            } else if (u && typeof u === "object") {
              return new UserImpl(u);
            } else {
              return new UserImpl({});
            }
          })
        );
        break;
      case "user_connected":
        if (typeof msg.user === "string") {
          allUsersStore.addUser(new UserImpl({ id: msg.user }));
        } else if (msg.user && typeof msg.user === "object") {
          allUsersStore.addUser(new UserImpl(msg.user));
        }
        break;
      case "user_disconnected":
        allUsersStore.removeUserById(msg.user);
        break;
      case "frame":
        activeUserStore.setScreen(msg.data, msg.mouse);
        break;
      default:
        console.warn("Unknown message type", msg.type);
        break;
    }
  }

  /**
   * Logout and close the websocket connection.
   */
  logout() {
    this.send({ type: "logout" });
    this.ws?.close();
  }

  /**
   * Send a mouse action for the active user.
   */
  sendMouse(action: { action: string; key: number; x: number; y: number }) {
    const activeUserStore = useActiveUserStore();
    if (activeUserStore.id) {
      this.send({ type: "mouse", ...action });
    }
  }
}

export const wsClient = new WebSocketClient();

/**
 * UserImpl is a concrete implementation of the User interface.
 */
class UserImpl implements User {
  id: string;
  name: string;
  ip: string;
  screen: string;
  mouse: { x: number; y: number };

  constructor({ id = "", name = "", ip = "", screen = "", mouse = { x: 0, y: 0 } }: Partial<User>) {
    this.id = id;
    this.name = name;
    this.ip = ip;
    this.screen = screen;
    this.mouse = mouse;
  }
}

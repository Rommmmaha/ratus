import type { ServerWebSocket } from "bun";

/**
 * WebSocketData interface for storing connection-specific data.
 */
export interface WebSocketData {
  uuid: string;
  [key: string]: unknown;
}

/**
 * Manages a set of WebSocket connections, allowing lookup and removal by UUID or socket.
 */
export class ConnectionManager {
  private sockets: Set<ServerWebSocket<WebSocketData>>;

  constructor() {
    this.sockets = new Set();
  }

  /**
   * Returns all active sockets.
   */
  getSockets(): Set<ServerWebSocket<WebSocketData>> {
    return this.sockets;
  }

  /**
   * Adds a new socket connection, assigning a UUID if not already present.
   * Returns true if added, false if already present.
   */
  connect(ws: ServerWebSocket<WebSocketData>): boolean {
    if (this.sockets.has(ws)) return false;
    ws.data = { uuid: Bun.randomUUIDv7() };
    this.sockets.add(ws);
    return true;
  }

  /**
   * Removes a socket connection by its WebSocket instance.
   */
  disconnectBySocket(ws: ServerWebSocket<WebSocketData>): boolean {
    return this.sockets.delete(ws);
  }

  /**
   * Removes a socket connection by its UUID.
   */
  disconnectByUuid(uuid: string): boolean {
    for (const ws of this.sockets) {
      if (ws.data?.uuid === uuid) {
        this.sockets.delete(ws);
        return true;
      }
    }
    return false;
  }

  /**
   * Retrieves a socket connection by its UUID.
   */
  getByUuid(uuid: string): ServerWebSocket<WebSocketData> | undefined {
    for (const ws of this.sockets) {
      if (ws.data?.uuid === uuid) {
        return ws;
      }
    }
    return undefined;
  }
}

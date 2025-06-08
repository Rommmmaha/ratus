import { type WebSocketData } from "./connection_manager.ts";
import { PacketsHandler } from "./handler";
import { log } from "./log";

const PORT = 5555;
const handler = new PacketsHandler();

console.log(`Starting server on port ${PORT}...`);

export const server = Bun.serve({
  port: PORT,
  async fetch(request, server) {
    if (server.upgrade(request)) return;

    const url = new URL(request.url);
    if (url.pathname === "/admin") {
      return Response.redirect(new URL("/admin/", url.origin).toString(), 301);
    }

    let filePath: string;
    if (url.pathname === "/download") {
      filePath = "./client-rust.exe";
    } else {
      filePath = `./admin${url.pathname}`;
      if (url.pathname === "/") {
        filePath = "./admin/index.html";
      }
    }

    if (filePath.includes("..")) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(file, { headers: { "Content-Type": file.type } });
  },
  websocket: {
    async open(ws: Bun.ServerWebSocket<WebSocketData>) {
      log("$C", ws.remoteAddress);
    },
    async close(ws) {
      handler.handleLogout(ws);
      log("$D", ws.remoteAddress);
    },
    async message(ws, message) {
      handler.handleMessage(ws, String(message));
    },
  },
});

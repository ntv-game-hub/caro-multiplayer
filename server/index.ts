import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { Server } from "socket.io";
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "../shared/types.js";
import { CLIENT_DIST, CORS_ORIGIN, HOST, PORT } from "./config.js";
import { registerSocketHandlers } from "./socketHandlers.js";

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ["websocket"],
  cors: { origin: CORS_ORIGIN }
});

registerSocketHandlers(io);

app.use(express.static(CLIENT_DIST));
app.get("*", (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, "index.html"));
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Caro multiplayer is running on http://${HOST}:${PORT}`);
});

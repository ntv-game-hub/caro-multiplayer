import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server, type Socket } from "socket.io";
import {
  PLAYER_COLORS,
  PLAYER_ICONS,
  cellKey,
  createGameState,
  findWinningLine,
  hasEnoughPlayers,
  nextPlayablePlayer,
  normalizeSlug,
  playablePlayers,
  roomStatus,
  uniqueDisplayName,
  updateTurnStatuses
} from "../shared/game.js";
import type {
  BoardCell,
  ClientToServerEvents,
  InterServerEvents,
  Player,
  Room,
  RoomSummary,
  ServerToClientEvents,
  SocketAck,
  SocketData
} from "../shared/types.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const rooms = new Map<string, Room>();
type AppServerSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ["websocket"],
  cors: {
    origin: process.env.CORS_ORIGIN || undefined
  }
});

function now() {
  return Date.now();
}

function publicRooms(): RoomSummary[] {
  return [...rooms.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((room) => ({
      slug: room.slug,
      name: room.name,
      maxPlayers: room.maxPlayers,
      playerCount: room.players.filter((player) => player.status !== "left").length,
      status: roomStatus(room)
    }));
}

function broadcastRooms() {
  io.emit("rooms:update", publicRooms());
}

function emitRoom(room: Room, updateRoomList = true) {
  room.updatedAt = now();
  updateTurnStatuses(room.players, room.game.currentPlayerId);
  io.to(room.slug).emit("room:state", room);
  if (updateRoomList) broadcastRooms();
}

function uniqueSlug(roomName: string) {
  const base = normalizeSlug(roomName);
  if (!rooms.has(base)) return base;

  let suffix = 2;
  while (rooms.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function createPlayer(payload: { playerId: string; playerName: string }, room: Room, socketId: string, isHost = false): Player {
  const index = room.players.length;
  const displayName = uniqueDisplayName(payload.playerName, room.players, payload.playerId);

  return {
    id: payload.playerId,
    socketId,
    name: payload.playerName.trim() || displayName,
    displayName,
    icon: PLAYER_ICONS[index % PLAYER_ICONS.length],
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    status: "playing",
    isHost,
    joinedAt: now(),
    connected: true,
    moves: 0
  };
}

function connectedPlayers(room: Room) {
  return room.players.filter((player) => player.connected && player.status !== "left");
}

function reassignHost(room: Room) {
  const host = room.players.find((player) => player.id === room.hostId && player.status !== "left");
  if (host) {
    room.players.forEach((player) => {
      player.isHost = player.id === host.id;
    });
    return;
  }

  const nextHost = connectedPlayers(room).sort((a, b) => a.joinedAt - b.joinedAt)[0];
  if (!nextHost) return;

  room.hostId = nextHost.id;
  room.players.forEach((player) => {
    player.isHost = player.id === nextHost.id;
  });
}

function ensureTurn(room: Room) {
  const current = room.players.find((player) => player.id === room.game.currentPlayerId);
  if (current?.connected && current.status !== "winner" && current.status !== "left") {
    updateTurnStatuses(room.players, room.game.currentPlayerId);
    return;
  }

  room.game.currentPlayerId = nextPlayablePlayer(room.players, room.game.currentPlayerId)?.id;
  updateTurnStatuses(room.players, room.game.currentPlayerId);
}

function startGame(room: Room) {
  if (!hasEnoughPlayers(room)) {
    room.game.status = "waiting";
    room.game.currentPlayerId = undefined;
    updateTurnStatuses(room.players, undefined);
    return "Cần ít nhất 2 bạn nhỏ để bắt đầu ván.";
  }

  room.game.status = "playing";
  room.game.startedAt = room.game.startedAt || now();
  room.game.endedAt = undefined;
  room.game.currentPlayerId = nextPlayablePlayer(room.players)?.id;
  ensureTurn(room);
  return undefined;
}

function endGame(room: Room) {
  room.game.status = "ended";
  room.game.endedAt = now();
  room.game.currentPlayerId = undefined;
  updateTurnStatuses(room.players, undefined);
}

function maybeFinishGame(room: Room) {
  if (room.game.status !== "playing") return;
  if (playablePlayers(room.players).length < 2) {
    endGame(room);
  }
}

function makeAck<T>(data: T): SocketAck<T> {
  return { ok: true, data };
}

function makeError<T>(error: string): SocketAck<T> {
  return { ok: false, error };
}

function leaveCurrentRoom(socketId: string, explicit = false) {
  const room = [...rooms.values()].find((candidate) => candidate.players.some((player) => player.socketId === socketId));
  if (!room) return;

  const player = room.players.find((candidate) => candidate.socketId === socketId);
  if (!player) return;

  player.connected = false;
  player.socketId = undefined;
  player.status = explicit ? "left" : "disconnected";

  if (explicit) {
    room.players = room.players.filter((candidate) => candidate.id !== player.id);
    reassignHost(room);
  }

  ensureTurn(room);
  maybeFinishGame(room);

  io.to(room.slug).emit("player:left", room, player);
  emitRoom(room);

  if (room.players.length === 0 || room.players.every((candidate) => candidate.status === "left")) {
    rooms.delete(room.slug);
    broadcastRooms();
  }
}

function joinSocketRoom(socket: AppServerSocket, room: Room, player: Player) {
  socket.join(room.slug);
  socket.data.roomSlug = room.slug;
  socket.data.playerId = player.id;
  player.socketId = socket.id;
  player.connected = true;
  if (player.status === "disconnected") player.status = "playing";
  ensureTurn(room);
}

io.on("connection", (socket) => {
  socket.emit("rooms:update", publicRooms());

  socket.on("rooms:list", () => {
    socket.emit("rooms:update", publicRooms());
  });

  socket.on("room:create", (payload, callback) => {
    const roomName = payload.roomName.trim() || `Phòng vui ${Math.floor(Math.random() * 900 + 100)}`;
    const slug = uniqueSlug(roomName);
    const room: Room = {
      slug,
      name: roomName,
      hostId: payload.playerId,
      maxPlayers: Math.min(Math.max(Number(payload.maxPlayers) || 4, 2), 8),
      players: [],
      game: createGameState(),
      createdAt: now(),
      updatedAt: now()
    };
    const player = createPlayer(payload, room, socket.id, true);
    room.players.push(player);
    rooms.set(slug, room);
    joinSocketRoom(socket, room, player);
    startGame(room);
    emitRoom(room);
    callback?.(makeAck({ room, player }));
  });

  socket.on("room:join", (payload, callback) => {
    const room = rooms.get(payload.roomSlug);
    if (!room) {
      const message = "Phòng này không còn tồn tại. Hãy tạo phòng mới nhé!";
      socket.emit("room:error", message);
      callback?.(makeError(message));
      return;
    }

    const existing = room.players.find((player) => player.id === payload.playerId && player.status !== "left");
    if (existing) {
      joinSocketRoom(socket, room, existing);
      io.to(room.slug).emit("player:reconnected", room, existing);
      emitRoom(room);
      callback?.(makeAck({ room, player: existing }));
      return;
    }

    const player = createPlayer(payload, room, socket.id);
    room.players.push(player);
    joinSocketRoom(socket, room, player);
    if (room.game.status === "waiting") {
      startGame(room);
    }
    io.to(room.slug).emit("player:joined", room, player);
    emitRoom(room);
    callback?.(makeAck({ room, player }));
  });

  socket.on("room:leave", () => {
    leaveCurrentRoom(socket.id, true);
    socket.leave(socket.data.roomSlug || "");
    socket.data.roomSlug = undefined;
    socket.data.playerId = undefined;
  });

  socket.on("player:rename", (payload, callback) => {
    const room = socket.data.roomSlug ? rooms.get(socket.data.roomSlug) : undefined;
    const player = room?.players.find((candidate) => candidate.id === socket.data.playerId && candidate.status !== "left");
    if (!room || !player) {
      const message = "Không tìm thấy bạn trong phòng này.";
      socket.emit("room:error", message);
      callback?.(makeError(message));
      return;
    }

    const displayName = uniqueDisplayName(payload.playerName, room.players, player.id);
    player.name = payload.playerName.trim() || displayName;
    player.displayName = displayName;

    room.game.moves.forEach((move) => {
      if (move.playerId === player.id) move.playerName = displayName;
    });
    Object.values(room.game.board).forEach((cell) => {
      if (cell.playerId === player.id) cell.playerName = displayName;
    });

    emitRoom(room);
    callback?.(makeAck({ room, player }));
  });

  socket.on("game:start", () => {
    const room = socket.data.roomSlug ? rooms.get(socket.data.roomSlug) : undefined;
    const player = room?.players.find((candidate) => candidate.id === socket.data.playerId);
    if (!room || !player?.isHost) return;

    const error = startGame(room);
    if (error) {
      socket.emit("room:error", error);
      return;
    }
    emitRoom(room);
  });

  socket.on("game:new-round", () => {
    const room = socket.data.roomSlug ? rooms.get(socket.data.roomSlug) : undefined;
    const player = room?.players.find((candidate) => candidate.id === socket.data.playerId);
    if (!room || !player?.isHost) return;

    room.players = room.players.filter((candidate) => candidate.status !== "left");
    room.players.forEach((candidate) => {
      candidate.rank = undefined;
      candidate.moves = 0;
      candidate.connected = true;
      candidate.status = "playing";
    });
    room.game = createGameState(room.game.round + 1);
    startGame(room);
    emitRoom(room);
  });

  socket.on("game:end", () => {
    const room = socket.data.roomSlug ? rooms.get(socket.data.roomSlug) : undefined;
    const player = room?.players.find((candidate) => candidate.id === socket.data.playerId);
    if (!room || !player?.isHost) return;

    endGame(room);
    io.to(room.slug).emit("game:ended", room);
    emitRoom(room);
  });

  socket.on("game:move", ({ x, y }, callback) => {
    const room = socket.data.roomSlug ? rooms.get(socket.data.roomSlug) : undefined;
    if (!room) {
      callback?.(makeError("Không tìm thấy phòng chơi."));
      return;
    }

    const player = room.players.find((candidate) => candidate.id === socket.data.playerId);
    if (!player || room.game.status !== "playing") {
      callback?.(makeError("Ván chơi chưa sẵn sàng."));
      return;
    }
    if (room.game.currentPlayerId !== player.id || player.status === "winner" || player.status === "left") {
      callback?.(makeError("Chưa đến lượt của bạn."));
      return;
    }

    const key = cellKey(x, y);
    if (room.game.board[key]) {
      socket.emit("room:error", "Ô này đã có bạn khác đặt rồi.");
      callback?.(makeError("Ô này đã có bạn khác đặt rồi."));
      return;
    }

    const move: BoardCell = {
      key,
      x,
      y,
      playerId: player.id,
      playerName: player.displayName,
      icon: player.icon,
      color: player.color,
      placedAt: now()
    };

    room.game.board[key] = move;
    room.game.moves.push(move);
    player.moves += 1;

    const line = findWinningLine(room.game.board, x, y, player.id);
    if (line) {
      player.status = "winner";
      player.rank = room.game.winners.length + 1;
      room.game.winners.push(player.id);
      room.game.winningLines[player.id] = line;
    }

    room.game.currentPlayerId = nextPlayablePlayer(room.players, player.id)?.id;
    ensureTurn(room);
    maybeFinishGame(room);

    if (room.game.endedAt) {
      io.to(room.slug).emit("game:ended", room);
      broadcastRooms();
    } else if (line) {
      io.to(room.slug).emit("game:winner", room, player, line);
      broadcastRooms();
    } else {
      io.to(room.slug).emit("game:move-applied", room, move);
      emitRoom(room, false);
    }
    callback?.(makeAck({ room, move }));
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket.id, false);
  });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Caro multiplayer is running on http://${HOST}:${PORT}`);
});

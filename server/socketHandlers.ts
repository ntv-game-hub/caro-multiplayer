import type { Server, Socket } from "socket.io";
import { cellKey, createGameState, findWinningLine, nextPlayablePlayer, uniqueDisplayName, updateTurnStatuses } from "../shared/game.js";
import type { BoardCell, ClientToServerEvents, InterServerEvents, Player, Room, ServerToClientEvents, SocketData } from "../shared/types.js";
import { makeAck, makeError } from "./lib/acks.js";
import { deleteRoom, findRoomBySocket, getRoom, publicRooms, saveRoom, uniqueSlug } from "./lib/roomStore.js";
import { createPlayer, endGame, ensureTurn, maybeFinishGame, now, reassignHost, resetRoomForNewRound, startGame } from "./lib/roomLifecycle.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function broadcastRooms(io: AppServer) {
  io.emit("rooms:update", publicRooms());
}

function emitRoom(io: AppServer, room: Room, updateRoomList = true) {
  room.updatedAt = now();
  updateTurnStatuses(room.players, room.game.currentPlayerId);
  io.to(room.slug).emit("room:state", room);
  if (updateRoomList) broadcastRooms(io);
}

function joinSocketRoom(socket: AppSocket, room: Room, player: Player) {
  socket.join(room.slug);
  socket.data.roomSlug = room.slug;
  socket.data.playerId = player.id;
  player.socketId = socket.id;
  player.connected = true;
  if (player.status === "disconnected") player.status = "playing";
  ensureTurn(room);
}

function leaveCurrentRoom(io: AppServer, socket: AppSocket, explicit = false) {
  const room = findRoomBySocket(socket.id);
  if (!room) return;

  const player = room.players.find((candidate) => candidate.socketId === socket.id);
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
  emitRoom(io, room);

  if (room.players.length === 0 || room.players.every((candidate) => candidate.status === "left")) {
    deleteRoom(room.slug);
    broadcastRooms(io);
  }
}

export function registerSocketHandlers(io: AppServer) {
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
      saveRoom(room);
      joinSocketRoom(socket, room, player);
      startGame(room);
      emitRoom(io, room);
      callback?.(makeAck({ room, player }));
    });

    socket.on("room:join", (payload, callback) => {
      const room = getRoom(payload.roomSlug);
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
        emitRoom(io, room);
        callback?.(makeAck({ room, player: existing }));
        return;
      }

      const player = createPlayer(payload, room, socket.id);
      room.players.push(player);
      joinSocketRoom(socket, room, player);
      if (room.game.status === "waiting") startGame(room);
      io.to(room.slug).emit("player:joined", room, player);
      emitRoom(io, room);
      callback?.(makeAck({ room, player }));
    });

    socket.on("room:leave", () => {
      leaveCurrentRoom(io, socket, true);
      socket.leave(socket.data.roomSlug || "");
      socket.data.roomSlug = undefined;
      socket.data.playerId = undefined;
    });

    socket.on("player:rename", (payload, callback) => {
      const room = socket.data.roomSlug ? getRoom(socket.data.roomSlug) : undefined;
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
      room.game.moves.forEach((move) => { if (move.playerId === player.id) move.playerName = displayName; });
      Object.values(room.game.board).forEach((cell) => { if (cell.playerId === player.id) cell.playerName = displayName; });

      emitRoom(io, room);
      callback?.(makeAck({ room, player }));
    });

    socket.on("game:start", () => {
      const room = socket.data.roomSlug ? getRoom(socket.data.roomSlug) : undefined;
      const player = room?.players.find((candidate) => candidate.id === socket.data.playerId);
      if (!room || !player?.isHost) return;

      const error = startGame(room);
      if (error) {
        socket.emit("room:error", error);
        return;
      }
      emitRoom(io, room);
    });

    socket.on("game:new-round", () => {
      const room = socket.data.roomSlug ? getRoom(socket.data.roomSlug) : undefined;
      const player = room?.players.find((candidate) => candidate.id === socket.data.playerId);
      if (!room || !player?.isHost) return;
      resetRoomForNewRound(room);
      emitRoom(io, room);
    });

    socket.on("game:end", () => {
      const room = socket.data.roomSlug ? getRoom(socket.data.roomSlug) : undefined;
      const player = room?.players.find((candidate) => candidate.id === socket.data.playerId);
      if (!room || !player?.isHost) return;
      endGame(room);
      io.to(room.slug).emit("game:ended", room);
      emitRoom(io, room);
    });

    socket.on("game:move", ({ x, y }, callback) => {
      const room = socket.data.roomSlug ? getRoom(socket.data.roomSlug) : undefined;
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

      const move: BoardCell = { key, x, y, playerId: player.id, playerName: player.displayName, icon: player.icon, color: player.color, placedAt: now() };
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
        broadcastRooms(io);
      } else if (line) {
        io.to(room.slug).emit("game:winner", room, player, line);
        broadcastRooms(io);
      } else {
        io.to(room.slug).emit("game:move-applied", room, move);
        emitRoom(io, room, false);
      }
      callback?.(makeAck({ room, move }));
    });

    socket.on("disconnect", () => {
      leaveCurrentRoom(io, socket, false);
    });
  });
}

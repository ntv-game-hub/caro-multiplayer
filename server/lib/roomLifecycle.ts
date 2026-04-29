import { PLAYER_COLORS, PLAYER_ICONS, createGameState, hasEnoughPlayers, nextPlayablePlayer, playablePlayers, uniqueDisplayName, updateTurnStatuses } from "../../shared/game.js";
import type { Player, Room } from "../../shared/types.js";

export function now() {
  return Date.now();
}

export function createPlayer(payload: { playerId: string; playerName: string }, room: Room, socketId: string, isHost = false): Player {
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

export function connectedPlayers(room: Room) {
  return room.players.filter((player) => player.connected && player.status !== "left");
}

export function reassignHost(room: Room) {
  const host = room.players.find((player) => player.id === room.hostId && player.status !== "left");
  if (host) {
    room.players.forEach((player) => { player.isHost = player.id === host.id; });
    return;
  }

  const nextHost = connectedPlayers(room).sort((a, b) => a.joinedAt - b.joinedAt)[0];
  if (!nextHost) return;

  room.hostId = nextHost.id;
  room.players.forEach((player) => { player.isHost = player.id === nextHost.id; });
}

export function ensureTurn(room: Room) {
  const current = room.players.find((player) => player.id === room.game.currentPlayerId);
  if (current?.connected && current.status !== "winner" && current.status !== "left") {
    updateTurnStatuses(room.players, room.game.currentPlayerId);
    return;
  }

  room.game.currentPlayerId = nextPlayablePlayer(room.players, room.game.currentPlayerId)?.id;
  updateTurnStatuses(room.players, room.game.currentPlayerId);
}

export function startGame(room: Room) {
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

export function endGame(room: Room) {
  room.game.status = "ended";
  room.game.endedAt = now();
  room.game.currentPlayerId = undefined;
  updateTurnStatuses(room.players, undefined);
}

export function maybeFinishGame(room: Room) {
  if (room.game.status !== "playing") return;
  if (playablePlayers(room.players).length < 2) endGame(room);
}

export function resetRoomForNewRound(room: Room) {
  room.players = room.players.filter((candidate) => candidate.status !== "left");
  room.players.forEach((candidate) => {
    candidate.rank = undefined;
    candidate.moves = 0;
    candidate.connected = true;
    candidate.status = "playing";
  });
  room.game = createGameState(room.game.round + 1);
  startGame(room);
}

import type { BoardCell, GameState, Player, Room, RoomStatus } from "./types.js";

export const WIN_LENGTH = 5;

export const PLAYER_ICONS = ["star", "heart", "sparkles", "flower", "sun", "moon", "rocket", "crown"];
export const PLAYER_COLORS = ["#c264ff", "#2eb872", "#ff6f7d", "#ffd76d", "#61c9ff", "#cc7dff", "#ff9f43", "#00b8a9"];

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
] as const;

export function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

export function createGameState(round = 1): GameState {
  return {
    board: {},
    moves: [],
    winners: [],
    winningLines: {},
    status: "waiting",
    round
  };
}

export function roomStatus(room: Room): RoomStatus {
  if (room.game.status === "ended") return "ended";
  if (activePlayers(room.players).length >= room.maxPlayers) return "full";
  return room.game.status;
}

export function activePlayers(players: Player[]) {
  return players.filter((player) => player.connected && player.status !== "left");
}

export function playablePlayers(players: Player[]) {
  return activePlayers(players).filter((player) => player.status !== "winner");
}

export function nextPlayablePlayer(players: Player[], currentPlayerId?: string) {
  const playable = playablePlayers(players);
  if (playable.length === 0) return undefined;
  if (!currentPlayerId) return playable[0];

  const active = activePlayers(players);
  const currentIndex = active.findIndex((player) => player.id === currentPlayerId);
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

  for (let step = 0; step < active.length; step += 1) {
    const candidate = active[(startIndex + step) % active.length];
    if (candidate && candidate.connected && candidate.status !== "winner" && candidate.status !== "left") {
      return candidate;
    }
  }

  return playable[0];
}

export function updateTurnStatuses(players: Player[], currentPlayerId?: string) {
  players.forEach((player) => {
    if (player.status === "winner" || player.status === "left") return;
    player.status = player.connected ? (player.id === currentPlayerId ? "turn" : "playing") : "disconnected";
  });
}

export function hasEnoughPlayers(room: Room) {
  return playablePlayers(room.players).length >= 2;
}

export function findWinningLine(board: Record<string, BoardCell>, x: number, y: number, playerId: string, winLength = WIN_LENGTH) {
  for (const [dx, dy] of DIRECTIONS) {
    const line = [cellKey(x, y)];

    for (const dir of [-1, 1]) {
      let step = 1;
      while (step < winLength) {
        const nx = x + dx * step * dir;
        const ny = y + dy * step * dir;
        const key = cellKey(nx, ny);
        if (board[key]?.playerId !== playerId) break;
        line.push(key);
        step += 1;
      }
    }

    if (line.length >= winLength) {
      return line.sort((a, b) => {
        const [ax, ay] = a.split(":").map(Number);
        const [bx, by] = b.split(":").map(Number);
        return ax - bx || ay - by;
      });
    }
  }

  return undefined;
}

export function normalizeSlug(input: string) {
  const slug = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);

  return slug || `phong-${Math.random().toString(36).slice(2, 8)}`;
}

export function uniqueDisplayName(name: string, existingPlayers: Player[], playerId?: string) {
  const cleanName = name.trim().replace(/\s+/g, " ") || "Ban nho";
  const existingNames = new Set(
    existingPlayers
      .filter((player) => player.id !== playerId && player.status !== "left")
      .map((player) => player.displayName.toLowerCase())
  );

  if (!existingNames.has(cleanName.toLowerCase())) return cleanName;

  let suffix = 2;
  while (existingNames.has(`${cleanName} ${suffix}`.toLowerCase())) {
    suffix += 1;
  }

  return `${cleanName} ${suffix}`;
}

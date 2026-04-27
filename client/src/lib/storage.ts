import type { HistoryEntry } from "../../../shared/types";

export const PLAYER_NAME_KEY = "caro.playerName";
export const PLAYER_ID_KEY = "caro.playerId";
export const HISTORY_KEY = "caro.history";

function createPlayerId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex
      .slice(8, 10)
      .join("")}-${hex.slice(10).join("")}`;
  }

  return `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function ensurePlayerId() {
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;

  const next = createPlayerId();
  localStorage.setItem(PLAYER_ID_KEY, next);
  return next;
}

export function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

export function appendHistory(entry: HistoryEntry) {
  const current = readHistory();
  if (current.some((item) => item.id === entry.id)) return current;

  const next = [entry, ...current].slice(0, 50);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

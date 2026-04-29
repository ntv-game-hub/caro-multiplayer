import type { HistoryEntry, Room } from "../../../shared/types";

export function makeHistoryEntry(room: Room, playerId: string, fallbackResult: string): HistoryEntry | undefined {
  const player = room.players.find((candidate) => candidate.id === playerId);
  if (!player) return undefined;

  const rankText = player.rank ? `Hạng ${player.rank}` : fallbackResult;
  return {
    id: `${room.slug}-${room.game.round}-${player.id}-${rankText}`,
    playerName: player.displayName,
    roomName: room.name,
    roomSlug: room.slug,
    playedAt: Date.now(),
    result: rankText,
    rank: player.rank,
    moves: player.moves,
    players: room.players.filter((candidate) => candidate.status !== "left").map((candidate) => candidate.displayName)
  };
}

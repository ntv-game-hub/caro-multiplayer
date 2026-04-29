import { normalizeSlug, roomStatus } from "../../shared/game.js";
import type { Room, RoomSummary } from "../../shared/types.js";

const rooms = new Map<string, Room>();

export function listRooms() {
  return [...rooms.values()];
}

export function getRoom(slug: string) {
  return rooms.get(slug);
}

export function saveRoom(room: Room) {
  rooms.set(room.slug, room);
}

export function deleteRoom(slug: string) {
  rooms.delete(slug);
}

export function hasRoom(slug: string) {
  return rooms.has(slug);
}

export function publicRooms(): RoomSummary[] {
  return listRooms()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((room) => ({
      slug: room.slug,
      name: room.name,
      maxPlayers: room.maxPlayers,
      playerCount: room.players.filter((player) => player.status !== "left").length,
      status: roomStatus(room)
    }));
}

export function uniqueSlug(roomName: string) {
  const base = normalizeSlug(roomName);
  if (!hasRoom(base)) return base;

  let suffix = 2;
  while (hasRoom(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function findRoomBySocket(socketId: string) {
  return listRooms().find((candidate) => candidate.players.some((player) => player.socketId === socketId));
}

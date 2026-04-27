export type PlayerStatus = "playing" | "turn" | "winner" | "disconnected" | "left";
export type RoomStatus = "waiting" | "playing" | "full" | "ended";

export interface Player {
  id: string;
  socketId?: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  status: PlayerStatus;
  isHost: boolean;
  joinedAt: number;
  connected: boolean;
  moves: number;
  rank?: number;
}

export interface Move {
  x: number;
  y: number;
  playerId: string;
  playerName: string;
  icon: string;
  color: string;
  placedAt: number;
}

export interface BoardCell extends Move {
  key: string;
}

export interface GameState {
  board: Record<string, BoardCell>;
  moves: Move[];
  currentPlayerId?: string;
  winners: string[];
  winningLines: Record<string, string[]>;
  status: RoomStatus;
  round: number;
  startedAt?: number;
  endedAt?: number;
}

export interface Room {
  slug: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  players: Player[];
  game: GameState;
  createdAt: number;
  updatedAt: number;
}

export interface RoomSummary {
  slug: string;
  name: string;
  maxPlayers: number;
  playerCount: number;
  status: RoomStatus;
}

export interface HistoryEntry {
  id: string;
  playerName: string;
  roomName: string;
  roomSlug: string;
  playedAt: number;
  result: string;
  rank?: number;
  moves: number;
  players: string[];
}

export interface ClientToServerEvents {
  "rooms:list": () => void;
  "room:create": (
    payload: { roomName: string; maxPlayers: number; playerName: string; playerId: string },
    callback?: (response: SocketAck<{ room: Room; player: Player }>) => void
  ) => void;
  "room:join": (
    payload: { roomSlug: string; playerName: string; playerId: string },
    callback?: (response: SocketAck<{ room: Room; player: Player }>) => void
  ) => void;
  "room:leave": () => void;
  "game:start": () => void;
  "game:move": (payload: { x: number; y: number }) => void;
  "game:new-round": () => void;
  "game:end": () => void;
}

export interface ServerToClientEvents {
  "rooms:update": (rooms: RoomSummary[]) => void;
  "room:state": (room: Room) => void;
  "room:error": (message: string) => void;
  "game:move-applied": (room: Room, move: Move) => void;
  "game:winner": (room: Room, player: Player, line: string[]) => void;
  "game:ended": (room: Room) => void;
  "player:joined": (room: Room, player: Player) => void;
  "player:left": (room: Room, player: Player) => void;
  "player:reconnected": (room: Room, player: Player) => void;
}

export interface InterServerEvents {}
export interface SocketData {
  roomSlug?: string;
  playerId?: string;
}

export type SocketAck<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

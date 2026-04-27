import { describe, expect, it } from "vitest";
import {
  cellKey,
  createGameState,
  findWinningLine,
  nextPlayablePlayer,
  hasEnoughPlayers,
  roomStatus,
  uniqueDisplayName,
  updateTurnStatuses
} from "../shared/game.js";
import type { BoardCell, Player, Room } from "../shared/types.js";

function makeCell(x: number, y: number, playerId = "p1"): BoardCell {
  return {
    key: cellKey(x, y),
    x,
    y,
    playerId,
    playerName: playerId,
    icon: "star",
    color: "#c264ff",
    placedAt: 1
  };
}

function player(id: string, status: Player["status"] = "playing"): Player {
  return {
    id,
    name: id,
    displayName: id,
    icon: "star",
    color: "#c264ff",
    status,
    isHost: false,
    joinedAt: 1,
    connected: status !== "disconnected",
    moves: 0
  };
}

describe("caro game logic", () => {
  it("detects five connected cells horizontally, vertically, and diagonally", () => {
    const horizontal = createGameState().board;
    const vertical = createGameState().board;
    const diagonal = createGameState().board;

    for (let i = 0; i < 5; i += 1) {
      horizontal[cellKey(i, 0)] = makeCell(i, 0);
      vertical[cellKey(2, i)] = makeCell(2, i);
      diagonal[cellKey(i, i)] = makeCell(i, i);
    }

    expect(findWinningLine(horizontal, 4, 0, "p1")).toHaveLength(5);
    expect(findWinningLine(vertical, 2, 4, "p1")).toHaveLength(5);
    expect(findWinningLine(diagonal, 4, 4, "p1")).toHaveLength(5);
  });

  it("does not count another player's pieces in a winning line", () => {
    const board = createGameState().board;
    for (let i = 0; i < 5; i += 1) {
      board[cellKey(i, 0)] = makeCell(i, 0, i === 2 ? "p2" : "p1");
    }

    expect(findWinningLine(board, 4, 0, "p1")).toBeUndefined();
  });

  it("skips winners and disconnected players when choosing the next turn", () => {
    const players = [player("p1"), player("p2", "winner"), player("p3", "disconnected"), player("p4")];
    updateTurnStatuses(players, "p1");

    expect(nextPlayablePlayer(players, "p1")?.id).toBe("p4");
  });

  it("creates a friendly duplicate name suffix in the same room", () => {
    const players = [player("p1"), player("p2")];
    players[0].displayName = "An";
    players[1].displayName = "An 2";

    expect(uniqueDisplayName("An", players)).toBe("An 3");
  });

  it("requires at least two playable players before a room can start", () => {
    const solo = player("p1");
    const duo = player("p2");
    const room: Room = {
      slug: "solo",
      name: "Solo",
      hostId: solo.id,
      maxPlayers: 4,
      players: [solo],
      game: createGameState(),
      createdAt: 1,
      updatedAt: 1
    };

    expect(hasEnoughPlayers(room)).toBe(false);
    expect(nextPlayablePlayer(room.players)?.id).toBe("p1");

    room.players.push(duo);
    expect(hasEnoughPlayers(room)).toBe(true);
  });

  it("keeps a room joinable even after the target player count is reached", () => {
    const room: Room = {
      slug: "busy",
      name: "Busy",
      hostId: "p1",
      maxPlayers: 2,
      players: [player("p1"), player("p2"), player("p3")],
      game: { ...createGameState(), status: "playing" },
      createdAt: 1,
      updatedAt: 1
    };

    expect(roomStatus(room)).toBe("playing");
  });
});

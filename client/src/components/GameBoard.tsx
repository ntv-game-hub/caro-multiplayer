import { useEffect, useRef, useState, type PointerEvent } from "react";
import { cellKey } from "../../../shared/game";
import type { BoardCell, Player, Room } from "../../../shared/types";
import { PlayerIcon } from "./PlayerIcon";

export function GameBoard({
  room,
  me,
  canPlay,
  onMove
}: {
  room: Room;
  me?: Player;
  canPlay: boolean;
  onMove: (x: number, y: number) => Promise<void>;
}) {
  const cells = Object.values(room.game.board);
  const [pendingCells, setPendingCells] = useState<Record<string, BoardCell>>({});
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewportMetrics, setViewportMetrics] = useState({ cellSize: 32, visibleColumns: 15, visibleRows: 15 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number; moved: boolean }>();
  const draggedRef = useRef(false);
  const cellSize = viewportMetrics.cellSize;
  const visibleColumns = viewportMetrics.visibleColumns;
  const visibleRows = viewportMetrics.visibleRows;
  const buffer = 3;
  const renderColumns = visibleColumns + buffer * 2;
  const renderRows = visibleRows + buffer * 2;
  const halfColumns = Math.floor(visibleColumns / 2);
  const halfRows = Math.floor(visibleRows / 2);
  const winningKeys = new Set(Object.values(room.game.winningLines).flat());
  const latestMoveByPlayer = new Map<string, string>();
  for (const move of room.game.moves) {
    latestMoveByPlayer.set(move.playerId, cellKey(move.x, move.y));
  }
  const latestMoveKeys = new Set(latestMoveByPlayer.values());
  const hasPendingCell = Object.keys(pendingCells).length > 0;
  const canPlaceMove = canPlay && !hasPendingCell;

  useEffect(() => {
    setPendingCells({});
  }, [room.game.round]);

  useEffect(() => {
    setPendingCells((current) => {
      const entries = Object.entries(current).filter(([key]) => !room.game.board[key]);
      return entries.length === Object.keys(current).length ? current : Object.fromEntries(entries);
    });
  }, [room.game.board, room.game.moves.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const syncCellSize = () => {
      const screenWidth = window.innerWidth;
      const visibleColumns = screenWidth < 640 ? 10 : screenWidth < 960 ? 18 : 24;
      const cellSize = viewport.clientWidth / visibleColumns;
      setViewportMetrics({
        cellSize,
        visibleColumns,
        visibleRows: Math.max(visibleColumns, Math.ceil(viewport.clientHeight / cellSize))
      });
    };
    syncCellSize();

    const observer = new ResizeObserver(syncCellSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (cells.length === 0) return;
    const last = cells[cells.length - 1];
    setCenter((current) => {
      if (Math.abs(last.x - current.x) > halfColumns - 2 || Math.abs(last.y - current.y) > halfRows - 2) {
        offsetRef.current = { x: 0, y: 0 };
        setOffset({ x: 0, y: 0 });
        return { x: last.x, y: last.y };
      }
      return current;
    });
  }, [cells.length]);

  const coordinates = [];
  for (let y = center.y - halfRows - buffer; y < center.y - halfRows - buffer + renderRows; y += 1) {
    for (let x = center.x - halfColumns - buffer; x < center.x - halfColumns - buffer + renderColumns; x += 1) {
      coordinates.push({ x, y, key: cellKey(x, y) });
    }
  }

  function panTo(nextOffset: { x: number; y: number }) {
    const shiftX = Math.trunc(nextOffset.x / cellSize);
    const shiftY = Math.trunc(nextOffset.y / cellSize);
    const normalized = {
      x: nextOffset.x - shiftX * cellSize,
      y: nextOffset.y - shiftY * cellSize
    };

    offsetRef.current = normalized;
    setOffset(normalized);

    if (shiftX || shiftY) {
      setCenter((current) => ({
        x: current.x - shiftX,
        y: current.y - shiftY
      }));
    }

    return { shiftX, shiftY, normalized };
  }

  function moveFromPointer(event: PointerEvent<HTMLDivElement>) {
    if (!canPlaceMove || !me) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const boardLeft = offset.x - buffer * cellSize;
    const boardTop = offset.y - buffer * cellSize;
    const column = Math.floor((event.clientX - rect.left - boardLeft) / cellSize);
    const row = Math.floor((event.clientY - rect.top - boardTop) / cellSize);

    if (column < 0 || column >= renderColumns || row < 0 || row >= renderRows) return;

    const x = center.x - halfColumns - buffer + column;
    const y = center.y - halfRows - buffer + row;
    const key = cellKey(x, y);
    if (room.game.board[key] || pendingCells[key]) return;

    const pendingCell: BoardCell = {
      key,
      x,
      y,
      playerId: me.id,
      playerName: me.displayName,
      icon: me.icon,
      color: me.color,
      placedAt: Date.now()
    };
    setPendingCells((current) => ({ ...current, [key]: pendingCell }));
    onMove(x, y).catch(() => {
      setPendingCells((current) => {
        const { [key]: _removed, ...next } = current;
        return next;
      });
    });
  }

  return (
    <section className={`board-wrap ${canPlaceMove ? "my-turn" : ""}`}>
      <div
        ref={viewportRef}
        className="board-viewport"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            offsetX: offsetRef.current.x,
            offsetY: offsetRef.current.y,
            moved: false
          };
          draggedRef.current = false;
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;

          const dx = event.clientX - drag.x;
          const dy = event.clientY - drag.y;
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            drag.moved = true;
            draggedRef.current = true;
          }
          const result = panTo({ x: drag.offsetX + dx, y: drag.offsetY + dy });
          if (result.shiftX || result.shiftY) {
            drag.x = event.clientX;
            drag.y = event.clientY;
            drag.offsetX = result.normalized.x;
            drag.offsetY = result.normalized.y;
          }
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          dragRef.current = undefined;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          if (!drag?.moved) {
            moveFromPointer(event);
            return;
          }
          window.setTimeout(() => {
            draggedRef.current = false;
          }, 80);
        }}
        onPointerCancel={(event) => {
          dragRef.current = undefined;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        <div
          className="board"
          style={{
            width: `${renderColumns * cellSize}px`,
            height: `${renderRows * cellSize}px`,
            gridTemplateColumns: `repeat(${renderColumns}, ${cellSize}px)`,
            gridAutoRows: `${cellSize}px`,
            backgroundSize: `${cellSize}px ${cellSize}px`,
            transform: `translate(${offset.x - buffer * cellSize}px, ${offset.y - buffer * cellSize}px)`
          }}
        >
          {coordinates.map(({ x, y, key }) => {
            const pendingCell = pendingCells[key];
            const cell = room.game.board[key] || pendingCell;
            return (
              <button
                className={`board-cell ${cell ? "filled pop-in" : ""} ${latestMoveKeys.has(key) ? "latest-move-cell" : ""} ${pendingCell ? "pending-cell" : ""} ${winningKeys.has(key) ? "winner-cell" : ""}`}
                key={key}
                type="button"
                aria-label={`Ô ${x}, ${y}`}
                disabled={!canPlaceMove || Boolean(cell)}
                tabIndex={-1}
              >
                {cell && <PlayerIcon player={cell} size={22} />}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}


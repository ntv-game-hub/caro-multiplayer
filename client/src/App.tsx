import {
  Clipboard,
  Crown,
  DoorOpen,
  Flower2,
  Heart,
  History,
  Home,
  Moon,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Rocket,
  Send,
  Settings,
  Sparkles,
  Star,
  Sun,
  Trophy,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { cellKey } from "../../shared/game";
import type {
  ClientToServerEvents,
  HistoryEntry,
  Player,
  Room,
  RoomSummary,
  ServerToClientEvents,
  SocketAck
} from "../../shared/types";
import { HISTORY_KEY, PLAYER_NAME_KEY, appendHistory, ensurePlayerId, readHistory } from "./lib/storage";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const iconMap = {
  star: Star,
  heart: Heart,
  sparkles: Sparkles,
  flower: Flower2,
  sun: Sun,
  moon: Moon,
  rocket: Rocket,
  crown: Crown
};

function PlayerIcon({ player, size = 18 }: { player: Pick<Player, "icon" | "color">; size?: number }) {
  const Icon = iconMap[player.icon as keyof typeof iconMap] || Star;
  return <Icon size={size} strokeWidth={2.8} style={{ color: player.color }} />;
}

function routeSlug() {
  const match = window.location.pathname.match(/^\/room\/([^/]+)/);
  return match?.[1];
}

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function makeHistoryEntry(room: Room, playerId: string, fallbackResult: string): HistoryEntry | undefined {
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

export function App() {
  const [socket, setSocket] = useState<AppSocket>();
  const [connected, setConnected] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [room, setRoom] = useState<Room>();
  const [slug, setSlug] = useState(routeSlug());
  const [playerName, setPlayerName] = useState(() => localStorage.getItem(PLAYER_NAME_KEY) || "");
  const [playerId] = useState(() => ensurePlayerId());
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState(() => readHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [renameName, setRenameName] = useState("");
  const joinedSlug = useRef<string>();

  useEffect(() => {
    const nextSocket: AppSocket = io({
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
    setSocket(nextSocket);
    setConnected(nextSocket.connected);

    nextSocket.on("connect", () => {
      joinedSlug.current = undefined;
      setConnected(true);
    });
    nextSocket.on("disconnect", () => setConnected(false));
    nextSocket.on("rooms:update", setRooms);
    nextSocket.on("room:state", (nextRoom) => setRoom(nextRoom));
    nextSocket.on("room:error", setMessage);
    nextSocket.on("game:winner", (nextRoom, winner) => {
      setRoom(nextRoom);
      setMessage(`${winner.displayName} đã về đích!`);
      const entry = makeHistoryEntry(nextRoom, playerId, "Đã tham gia");
      if (entry && winner.id === playerId) setHistory(appendHistory(entry));
      window.setTimeout(() => setMessage(""), 2600);
    });
    nextSocket.on("game:ended", (nextRoom) => {
      setRoom(nextRoom);
      const entry = makeHistoryEntry(nextRoom, playerId, "Ván đã kết thúc");
      if (entry) setHistory(appendHistory(entry));
    });
    nextSocket.on("player:joined", (nextRoom, player) => {
      setRoom(nextRoom);
      setMessage(`${player.displayName} đã vào phòng`);
      window.setTimeout(() => setMessage(""), 1800);
    });
    nextSocket.on("player:reconnected", (nextRoom, player) => {
      setRoom(nextRoom);
      setMessage(`${player.displayName} đã quay lại`);
      window.setTimeout(() => setMessage(""), 1800);
    });
    nextSocket.emit("rooms:list");

    return () => {
      nextSocket.disconnect();
    };
  }, [playerId]);

  useEffect(() => {
    const onPopState = () => {
      setSlug(routeSlug());
      joinedSlug.current = undefined;
      setRoom(undefined);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!socket || !connected || !slug || !playerName.trim() || joinedSlug.current === slug) return;
    joinedSlug.current = slug;
    localStorage.setItem(PLAYER_NAME_KEY, playerName.trim());
    socket.emit("room:join", { roomSlug: slug, playerName: playerName.trim(), playerId }, (response) => {
      if (response.ok) {
        setRoom(response.data.room);
      } else {
        setMessage(response.error);
        joinedSlug.current = undefined;
      }
    });
  }, [connected, playerId, playerName, slug, socket]);

  const me = useMemo(() => room?.players.find((player) => player.id === playerId), [playerId, room]);
  const currentPlayer = useMemo(() => room?.players.find((player) => player.id === room.game.currentPlayerId), [room]);
  const canPlay = Boolean(room && me && room.game.status === "playing" && room.game.currentPlayerId === me.id && me.status === "turn");

  function savePlayerName() {
    const cleanName = playerName.trim() || "Bạn nhỏ";
    setPlayerName(cleanName);
    localStorage.setItem(PLAYER_NAME_KEY, cleanName);
    return cleanName;
  }

  function createRoom() {
    if (!socket) return;
    const cleanName = savePlayerName();
    const cleanRoom = roomName.trim() || `Phòng vui ${Math.floor(Math.random() * 900 + 100)}`;

    socket.emit(
      "room:create",
      { roomName: cleanRoom, maxPlayers, playerName: cleanName, playerId },
      (response: SocketAck<{ room: Room; player: Player }>) => {
        if (!response.ok) {
          setMessage(response.error);
          return;
        }
        setRoom(response.data.room);
        joinedSlug.current = response.data.room.slug;
        navigate(`/room/${response.data.room.slug}`);
      }
    );
  }

  function joinRoom(roomSlug: string) {
    savePlayerName();
    navigate(`/room/${roomSlug}`);
  }

  function leaveRoom() {
    socket?.emit("room:leave");
    joinedSlug.current = undefined;
    setRoom(undefined);
    navigate("/");
  }

  function copyLink() {
    if (!room) return;
    navigator.clipboard.writeText(`${window.location.origin}/room/${room.slug}`);
    setMessage("Đã sao chép link phòng!");
    window.setTimeout(() => setMessage(""), 1600);
  }

  function openRename() {
    setRenameName(me?.displayName || playerName);
    setShowRename(true);
  }

  function renamePlayer() {
    if (!socket) return;
    socket.emit("player:rename", { playerName: renameName }, (response) => {
      if (!response.ok) {
        setMessage(response.error);
        return;
      }

      const nextName = response.data.player.displayName;
      setPlayerName(nextName);
      localStorage.setItem(PLAYER_NAME_KEY, nextName);
      setRoom(response.data.room);
      setShowRename(false);
      setMessage(`Đã đổi tên thành ${nextName}`);
      window.setTimeout(() => setMessage(""), 1800);
    });
  }

  if (!slug) {
    return (
      <main className="app-shell home-screen">
        <section className="home-top">
          <div>
            <p className="eyebrow">Caro Multiplayer</p>
            <h1>Caro Vui Vẻ</h1>
          </div>
          <button className="icon-button" type="button" onClick={() => setShowHistory(true)} aria-label="Lịch sử">
            <History size={20} />
          </button>
        </section>

        <section className="quick-panel">
          <label>
            Tên của bạn
            <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Ví dụ: An" maxLength={24} />
          </label>
          <div className="create-grid">
            <label>
              Tên phòng
              <input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Phòng cầu vồng" maxLength={36} />
            </label>
            <label>
              Mục tiêu số bạn
              <input
                value={maxPlayers}
                onChange={(event) => setMaxPlayers(Number(event.target.value))}
                type="number"
                min={2}
                max={8}
              />
            </label>
          </div>
          <button className="primary-button" type="button" onClick={createRoom}>
            <Plus size={18} /> Tạo phòng
          </button>
        </section>

        <section className="room-list">
          <div className="section-title">
            <h2>Phòng đang mở</h2>
            <span className={connected ? "status-dot online" : "status-dot"}>{connected ? "Đang kết nối" : "Mất kết nối"}</span>
          </div>
          {rooms.length === 0 ? (
            <div className="empty-state">
              <Sparkles size={28} />
              <p>Chưa có phòng nào. Tạo một phòng thật xinh để mời bạn bè vào chơi nhé.</p>
            </div>
          ) : (
            rooms.map((item) => (
              <article className="room-card" key={item.slug}>
                <div>
                  <h3>{item.name}</h3>
                  <p>
                    {item.playerCount}/{item.maxPlayers} bạn · {item.status === "playing" ? "Đang chơi" : item.status === "ended" ? "Đã kết thúc" : "Đang chờ"}
                  </p>
                </div>
                <button type="button" onClick={() => joinRoom(item.slug)}>
                  <Send size={17} /> Vào
                </button>
              </article>
            ))
          )}
        </section>

        <HistorySheet open={showHistory} history={history} onClose={() => setShowHistory(false)} />
        {message && <Toast message={message} />}
      </main>
    );
  }

  if (!playerName.trim()) {
    return (
      <main className="app-shell join-screen">
        <button className="ghost-button" type="button" onClick={() => navigate("/")}>
          <Home size={17} /> Về danh sách
        </button>
        <section className="quick-panel">
          <p className="eyebrow">Phòng {slug}</p>
          <h1>Nhập tên để vào chơi</h1>
          <label>
            Tên của bạn
            <input autoFocus value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Ví dụ: Bình" />
          </label>
          <button className="primary-button" type="button" onClick={() => joinRoom(slug)}>
            <Send size={18} /> Vào phòng
          </button>
        </section>
        {message && <Toast message={message} />}
      </main>
    );
  }

  return (
    <main className="game-shell">
      <header className="game-header">
        <button className="icon-button" type="button" onClick={() => navigate("/")} aria-label="Về trang chủ">
          <Home size={19} />
        </button>
        <div className="room-heading">
          <strong>{room?.name || slug}</strong>
          <span>
            <Users size={14} /> {room ? room.players.filter((player) => player.status !== "left").length : 0}/{room?.maxPlayers || "-"}
          </span>
        </div>
        <button className="icon-button" type="button" onClick={() => setShowSettings(true)} aria-label="Cài đặt">
          <Settings size={19} />
        </button>
      </header>

      {room ? (
        <>
          <PlayerRail players={room.players} currentPlayerId={room.game.currentPlayerId} />
          <section className="turn-banner">
            {room.game.status === "waiting" && "Đang chờ thêm bạn. Cần ít nhất 2 người để bắt đầu."}
            {room.game.status === "playing" && (
              <>
                Lượt của <strong> {currentPlayer?.displayName || "bạn tiếp theo"}</strong>
              </>
            )}
            {room.game.status === "ended" && "Ván chơi đã kết thúc"}
          </section>

          <GameBoard room={room} canPlay={canPlay} onMove={(x, y) => socket?.emit("game:move", { x, y })} />
        </>
      ) : (
        <section className="loading-room">
          <Sparkles className="spin-soft" size={42} />
          <p>Đang tìm phòng...</p>
        </section>
      )}

      <HistorySheet open={showHistory} history={history} onClose={() => setShowHistory(false)} />
      <RenameSheet
        open={showRename}
        value={renameName}
        onChange={setRenameName}
        onClose={() => setShowRename(false)}
        onSubmit={renamePlayer}
      />
      <SettingsSheet
        open={showSettings}
        canStart={Boolean(me?.isHost && room?.game.status !== "playing")}
        canCreateNewRound={Boolean(me?.isHost)}
        onClose={() => setShowSettings(false)}
        onCopyLink={() => {
          copyLink();
          setShowSettings(false);
        }}
        onOpenHistory={() => {
          setShowSettings(false);
          setShowHistory(true);
        }}
        onOpenRename={() => {
          setShowSettings(false);
          openRename();
        }}
        onStart={() => {
          socket?.emit("game:start");
          setShowSettings(false);
        }}
        onNewRound={() => {
          socket?.emit("game:new-round");
          setShowSettings(false);
        }}
        onLeave={leaveRoom}
      />
      {message && <Toast message={message} />}
    </main>
  );
}

function PlayerRail({ players, currentPlayerId }: { players: Player[]; currentPlayerId?: string }) {
  return (
    <section className="player-rail">
      {players
        .filter((player) => player.status !== "left")
        .map((player) => (
          <div className={`player-pill ${player.id === currentPlayerId ? "active" : ""} ${player.status}`} key={player.id}>
            <span className="avatar" style={{ borderColor: player.color, backgroundColor: `${player.color}22` }}>
              <PlayerIcon player={player} />
            </span>
            <span>{player.displayName}</span>
            {player.rank && (
              <small>
                <Trophy size={13} /> #{player.rank}
              </small>
            )}
          </div>
        ))}
    </section>
  );
}

function GameBoard({ room, canPlay, onMove }: { room: Room; canPlay: boolean; onMove: (x: number, y: number) => void }) {
  const cells = Object.values(room.game.board);
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

  function moveFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!canPlay) return;

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
    if (room.game.board[cellKey(x, y)]) return;

    onMove(x, y);
  }

  return (
    <section className={`board-wrap ${canPlay ? "my-turn" : ""}`}>
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
            const cell = room.game.board[key];
            return (
              <button
                className={`board-cell ${cell ? "filled pop-in" : ""} ${winningKeys.has(key) ? "winner-cell" : ""}`}
                key={key}
                type="button"
                aria-label={`Ô ${x}, ${y}`}
                disabled={!canPlay || Boolean(cell)}
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

function SettingsSheet({
  open,
  canStart,
  canCreateNewRound,
  onClose,
  onCopyLink,
  onOpenHistory,
  onOpenRename,
  onStart,
  onNewRound,
  onLeave
}: {
  open: boolean;
  canStart: boolean;
  canCreateNewRound: boolean;
  onClose: () => void;
  onCopyLink: () => void;
  onOpenHistory: () => void;
  onOpenRename: () => void;
  onStart: () => void;
  onNewRound: () => void;
  onLeave: () => void;
}) {
  if (!open) return null;

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-title">
          <h2>Cài đặt</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <div className="settings-actions">
          <button type="button" onClick={onCopyLink}>
            <Clipboard size={18} /> Sao chép link
          </button>
          <button type="button" onClick={onOpenHistory}>
            <History size={18} /> Lịch sử
          </button>
          <button type="button" onClick={onOpenRename}>
            <Pencil size={18} /> Đổi tên
          </button>
          {canStart && (
            <button type="button" onClick={onStart}>
              <Play size={18} /> Bắt đầu
            </button>
          )}
          {canCreateNewRound && (
            <button type="button" onClick={onNewRound}>
              <RefreshCcw size={18} /> Ván mới
            </button>
          )}
          <button type="button" onClick={onLeave}>
            <DoorOpen size={18} /> Rời phòng
          </button>
        </div>
      </section>
    </div>
  );
}

function HistorySheet({ open, history, onClose }: { open: boolean; history: HistoryEntry[]; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-title">
          <h2>Lịch sử chơi</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        {history.length === 0 ? (
          <p className="muted">Chưa có ván nào được lưu trên máy này.</p>
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <article key={item.id}>
                <strong>{item.roomName}</strong>
                <span>{new Date(item.playedAt).toLocaleString("vi-VN")}</span>
                <p>
                  {item.result} · {item.moves} nước · {item.players.join(", ")}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RenameSheet({
  open,
  value,
  onChange,
  onClose,
  onSubmit
}: {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-title">
          <h2>Đổi tên</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <form
          className="rename-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label>
            Tên mới
            <input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder="Ví dụ: Minh Anh" maxLength={24} />
          </label>
          <button className="primary-button" type="submit">
            <Pencil size={18} /> Lưu tên
          </button>
        </form>
      </section>
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="toast">
      <Sparkles size={18} />
      <span>{message}</span>
    </div>
  );
}

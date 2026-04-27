import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Clipboard,
  Crown,
  DoorOpen,
  Flower2,
  Heart,
  History,
  Home,
  Moon,
  Play,
  Plus,
  RefreshCcw,
  Rocket,
  Send,
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

  const rankText = player.rank ? `Hang ${player.rank}` : fallbackResult;
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
  const joinedSlug = useRef<string>();

  useEffect(() => {
    const nextSocket: AppSocket = io();
    setSocket(nextSocket);

    nextSocket.on("connect", () => setConnected(true));
    nextSocket.on("disconnect", () => setConnected(false));
    nextSocket.on("rooms:update", setRooms);
    nextSocket.on("room:state", (nextRoom) => setRoom(nextRoom));
    nextSocket.on("room:error", setMessage);
    nextSocket.on("game:winner", (nextRoom, winner) => {
      setRoom(nextRoom);
      setMessage(`${winner.displayName} da ve dich!`);
      const entry = makeHistoryEntry(nextRoom, playerId, "Da tham gia");
      if (entry && winner.id === playerId) setHistory(appendHistory(entry));
      window.setTimeout(() => setMessage(""), 2600);
    });
    nextSocket.on("game:ended", (nextRoom) => {
      setRoom(nextRoom);
      const entry = makeHistoryEntry(nextRoom, playerId, "Van da ket thuc");
      if (entry) setHistory(appendHistory(entry));
    });
    nextSocket.on("player:joined", (nextRoom, player) => {
      setRoom(nextRoom);
      setMessage(`${player.displayName} da vao phong`);
      window.setTimeout(() => setMessage(""), 1800);
    });
    nextSocket.on("player:reconnected", (nextRoom, player) => {
      setRoom(nextRoom);
      setMessage(`${player.displayName} da quay lai`);
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
    if (!socket || !slug || !playerName.trim() || joinedSlug.current === slug) return;
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
  }, [playerId, playerName, slug, socket]);

  const me = useMemo(() => room?.players.find((player) => player.id === playerId), [playerId, room]);
  const currentPlayer = useMemo(() => room?.players.find((player) => player.id === room.game.currentPlayerId), [room]);
  const canPlay = Boolean(room && me && room.game.status === "playing" && room.game.currentPlayerId === me.id && me.status === "turn");

  function savePlayerName() {
    const cleanName = playerName.trim() || "Ban nho";
    setPlayerName(cleanName);
    localStorage.setItem(PLAYER_NAME_KEY, cleanName);
    return cleanName;
  }

  function createRoom() {
    if (!socket) return;
    const cleanName = savePlayerName();
    const cleanRoom = roomName.trim() || `Phong vui ${Math.floor(Math.random() * 900 + 100)}`;

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
    setMessage("Da copy link phong!");
    window.setTimeout(() => setMessage(""), 1600);
  }

  if (!slug) {
    return (
      <main className="app-shell home-screen">
        <section className="home-top">
          <div>
            <p className="eyebrow">Caro Multiplayer</p>
            <h1>Caro Vui Ve</h1>
          </div>
          <button className="icon-button" type="button" onClick={() => setShowHistory(true)} aria-label="Lich su">
            <History size={20} />
          </button>
        </section>

        <section className="quick-panel">
          <label>
            Ten cua ban
            <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Vi du: An" maxLength={24} />
          </label>
          <div className="create-grid">
            <label>
              Ten phong
              <input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Phong cau vong" maxLength={36} />
            </label>
            <label>
              So ban
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
            <Plus size={18} /> Tao phong
          </button>
        </section>

        <section className="room-list">
          <div className="section-title">
            <h2>Phong dang mo</h2>
            <span className={connected ? "status-dot online" : "status-dot"}>{connected ? "Online" : "Offline"}</span>
          </div>
          {rooms.length === 0 ? (
            <div className="empty-state">
              <Sparkles size={28} />
              <p>Chua co phong nao. Tao mot phong that xinh de moi ban be vao choi nhe.</p>
            </div>
          ) : (
            rooms.map((item) => (
              <article className="room-card" key={item.slug}>
                <div>
                  <h3>{item.name}</h3>
                  <p>
                    {item.playerCount}/{item.maxPlayers} ban · {item.status === "playing" ? "Dang choi" : item.status === "full" ? "Da day" : "Dang cho"}
                  </p>
                </div>
                <button type="button" onClick={() => joinRoom(item.slug)} disabled={item.status === "full" || item.status === "ended"}>
                  <Send size={17} /> Vao
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
          <Home size={17} /> Ve danh sach
        </button>
        <section className="quick-panel">
          <p className="eyebrow">Phong {slug}</p>
          <h1>Nhap ten de vao choi</h1>
          <label>
            Ten cua ban
            <input autoFocus value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Vi du: Binh" />
          </label>
          <button className="primary-button" type="button" onClick={() => joinRoom(slug)}>
            <Send size={18} /> Vao phong
          </button>
        </section>
        {message && <Toast message={message} />}
      </main>
    );
  }

  return (
    <main className="game-shell">
      <header className="game-header">
        <button className="icon-button" type="button" onClick={() => navigate("/")} aria-label="Ve trang chu">
          <Home size={19} />
        </button>
        <div className="room-heading">
          <strong>{room?.name || slug}</strong>
          <span>
            <Users size={14} /> {room ? room.players.filter((player) => player.status !== "left").length : 0}/{room?.maxPlayers || "-"}
          </span>
        </div>
        <button className="icon-button" type="button" onClick={copyLink} aria-label="Copy link">
          <Clipboard size={19} />
        </button>
      </header>

      {room ? (
        <>
          <PlayerRail players={room.players} currentPlayerId={room.game.currentPlayerId} />
          <section className="turn-banner">
            {room.game.status === "waiting" && "Dang cho them ban. Chu phong co the bat dau khi du 2 ban."}
            {room.game.status === "playing" && (
              <>
                Luot cua <strong>{currentPlayer?.displayName || "ban tiep theo"}</strong>
              </>
            )}
            {room.game.status === "ended" && "Van choi da ket thuc"}
          </section>

          <GameBoard room={room} canPlay={canPlay} onMove={(x, y) => socket?.emit("game:move", { x, y })} />

          <nav className="bottom-actions">
            <button type="button" onClick={() => setShowHistory(true)}>
              <History size={18} /> Lich su
            </button>
            {me?.isHost && room.game.status !== "playing" && (
              <button type="button" onClick={() => socket?.emit("game:start")} disabled={room.players.filter((player) => player.connected).length < 2}>
                <Play size={18} /> Bat dau
              </button>
            )}
            {me?.isHost && (
              <button type="button" onClick={() => socket?.emit("game:new-round")}>
                <RefreshCcw size={18} /> Van moi
              </button>
            )}
            <button type="button" onClick={leaveRoom}>
              <DoorOpen size={18} /> Roi
            </button>
          </nav>
        </>
      ) : (
        <section className="loading-room">
          <Sparkles className="spin-soft" size={42} />
          <p>Dang tim phong...</p>
        </section>
      )}

      <HistorySheet open={showHistory} history={history} onClose={() => setShowHistory(false)} />
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
  const dragRef = useRef<{ x: number; y: number }>();
  const draggedRef = useRef(false);
  const size = 15;
  const half = Math.floor(size / 2);
  const winningKeys = new Set(Object.values(room.game.winningLines).flat());

  useEffect(() => {
    if (cells.length === 0) return;
    const last = cells[cells.length - 1];
    setCenter((current) => {
      if (Math.abs(last.x - current.x) > half - 2 || Math.abs(last.y - current.y) > half - 2) {
        return { x: last.x, y: last.y };
      }
      return current;
    });
  }, [cells.length]);

  const coordinates = [];
  for (let y = center.y - half; y <= center.y + half; y += 1) {
    for (let x = center.x - half; x <= center.x + half; x += 1) {
      coordinates.push({ x, y, key: cellKey(x, y) });
    }
  }

  function nudge(dx: number, dy: number) {
    setCenter((current) => ({ x: current.x + dx, y: current.y + dy }));
  }

  return (
    <section className={`board-wrap ${canPlay ? "my-turn" : ""}`}>
      <div
        className="board"
        onPointerDown={(event) => {
          dragRef.current = { x: event.clientX, y: event.clientY };
          draggedRef.current = false;
        }}
        onPointerUp={(event) => {
          if (!dragRef.current) return;
          const dx = event.clientX - dragRef.current.x;
          const dy = event.clientY - dragRef.current.y;
          dragRef.current = undefined;
          if (Math.abs(dx) < 38 && Math.abs(dy) < 38) return;
          draggedRef.current = true;
          nudge(Math.round(-dx / 42), Math.round(-dy / 42));
          window.setTimeout(() => {
            draggedRef.current = false;
          }, 0);
        }}
      >
        {coordinates.map(({ x, y, key }) => {
          const cell = room.game.board[key];
          return (
            <button
              className={`board-cell ${cell ? "filled pop-in" : ""} ${winningKeys.has(key) ? "winner-cell" : ""}`}
              key={key}
              type="button"
              aria-label={`O ${x}, ${y}`}
              disabled={!canPlay || Boolean(cell)}
              onClick={() => {
                if (draggedRef.current) return;
                onMove(x, y);
              }}
            >
              {cell && <PlayerIcon player={cell} size={22} />}
            </button>
          );
        })}
      </div>
      <div className="pan-pad">
        <button type="button" onClick={() => nudge(0, -3)} aria-label="Len">
          <ArrowUp size={16} />
        </button>
        <button type="button" onClick={() => nudge(-3, 0)} aria-label="Trai">
          <ArrowLeft size={16} />
        </button>
        <button type="button" onClick={() => setCenter({ x: 0, y: 0 })} aria-label="Ve giua">
          <Sparkles size={16} />
        </button>
        <button type="button" onClick={() => nudge(3, 0)} aria-label="Phai">
          <ArrowRight size={16} />
        </button>
        <button type="button" onClick={() => nudge(0, 3)} aria-label="Xuong">
          <ArrowDown size={16} />
        </button>
      </div>
    </section>
  );
}

function HistorySheet({ open, history, onClose }: { open: boolean; history: HistoryEntry[]; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-title">
          <h2>Lich su choi</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Dong">
            <X size={18} />
          </button>
        </div>
        {history.length === 0 ? (
          <p className="muted">Chua co van nao duoc luu tren may nay.</p>
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <article key={item.id}>
                <strong>{item.roomName}</strong>
                <span>{new Date(item.playedAt).toLocaleString("vi-VN")}</span>
                <p>
                  {item.result} · {item.moves} nuoc · {item.players.join(", ")}
                </p>
              </article>
            ))}
          </div>
        )}
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

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  Player,
  Room,
  RoomSummary,
  ServerToClientEvents,
  SocketAck
} from "../../shared/types";
import { PLAYER_NAME_KEY, appendHistory, ensurePlayerId, readHistory } from "./lib/storage";
import { makeHistoryEntry } from "./utils/history";
import { GameScreen } from "./screens/GameScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { JoinGateScreen } from "./screens/JoinGateScreen";
import { navigate, routeSlug } from "./utils/navigation";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function App() {
  const [socket, setSocket] = useState<AppSocket>();
  const [connected, setConnected] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [room, setRoom] = useState<Room>();
  const [slug, setSlug] = useState(routeSlug());
  const [playerName, setPlayerName] = useState(() => localStorage.getItem(PLAYER_NAME_KEY) || "");
  const [joinRequested, setJoinRequested] = useState(() => Boolean(routeSlug() && localStorage.getItem(PLAYER_NAME_KEY)?.trim()));
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
      const nextSlug = routeSlug();
      setSlug(nextSlug);
      setJoinRequested(Boolean(nextSlug && localStorage.getItem(PLAYER_NAME_KEY)?.trim()));
      joinedSlug.current = undefined;
      setRoom(undefined);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!socket || !connected || !slug || !joinRequested || !playerName.trim() || joinedSlug.current === slug) return;
    joinedSlug.current = slug;
    localStorage.setItem(PLAYER_NAME_KEY, playerName.trim());
    socket.emit("room:join", { roomSlug: slug, playerName: playerName.trim(), playerId }, (response) => {
      if (response.ok) {
        setRoom(response.data.room);
      } else {
        setMessage(response.error);
        setJoinRequested(false);
        joinedSlug.current = undefined;
      }
    });
  }, [connected, joinRequested, playerId, playerName, slug, socket]);

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
        setJoinRequested(true);
        navigate(`/room/${response.data.room.slug}`);
      }
    );
  }

  function joinRoom(roomSlug: string) {
    savePlayerName();
    setJoinRequested(true);
    navigate(`/room/${roomSlug}`);
  }

  function leaveRoom() {
    socket?.emit("room:leave");
    joinedSlug.current = undefined;
    setJoinRequested(false);
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
      <HomeScreen
        connected={connected}
        history={history}
        maxPlayers={maxPlayers}
        message={message}
        playerName={playerName}
        roomName={roomName}
        rooms={rooms}
        showHistory={showHistory}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onSetMaxPlayers={setMaxPlayers}
        onSetPlayerName={setPlayerName}
        onSetRoomName={setRoomName}
        onToggleHistory={setShowHistory}
      />
    );
  }


  if (!playerName.trim() || (!room && !joinRequested)) {
    return (
      <JoinGateScreen
        message={message}
        playerName={playerName}
        slug={slug}
        onBackHome={() => navigate("/")}
        onJoinRoom={joinRoom}
        onSetPlayerName={setPlayerName}
      />
    );
  }


  return (
    <GameScreen
      canPlay={canPlay}
      currentPlayer={currentPlayer}
      history={history}
      me={me}
      message={message}
      renameName={renameName}
      room={room}
      showHistory={showHistory}
      showRename={showRename}
      showSettings={showSettings}
      slug={slug}
      onBackHome={() => navigate("/")}
      onCopyLink={() => {
        copyLink();
        setShowSettings(false);
      }}
      onLeaveRoom={leaveRoom}
      onMove={(x, y) =>
        new Promise((resolve, reject) => {
          if (!socket) {
            reject(new Error("Mất kết nối."));
            return;
          }
          socket.emit("game:move", { x, y }, (response) => {
            if (response.ok) {
              resolve();
              return;
            }
            setMessage(response.error);
            reject(new Error(response.error));
          });
        })
      }
      onNewRound={() => socket?.emit("game:new-round")}
      onOpenRename={openRename}
      onRename={renamePlayer}
      onSetRenameName={setRenameName}
      onStart={() => socket?.emit("game:start")}
      onToggleHistory={setShowHistory}
      onToggleRename={setShowRename}
      onToggleSettings={setShowSettings}
    />
  );

}

export default App;

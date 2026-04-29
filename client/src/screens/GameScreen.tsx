import { Home, Settings, Sparkles, Users } from "lucide-react";
import type { HistoryEntry, Player, Room } from "../../../shared/types";
import { GameBoard } from "../components/GameBoard";
import { PlayerRail } from "../components/PlayerRail";
import { HistorySheet, RenameSheet, SettingsSheet, Toast } from "../components/Sheets";

type GameScreenProps = {
  canPlay: boolean;
  currentPlayer?: Player;
  history: HistoryEntry[];
  me?: Player;
  message: string;
  renameName: string;
  room?: Room;
  showHistory: boolean;
  showRename: boolean;
  showSettings: boolean;
  slug?: string;
  onBackHome: () => void;
  onCopyLink: () => void;
  onLeaveRoom: () => void;
  onMove: (x: number, y: number) => Promise<void>;
  onNewRound: () => void;
  onOpenRename: () => void;
  onRename: () => void;
  onSetRenameName: (value: string) => void;
  onStart: () => void;
  onToggleHistory: (value: boolean) => void;
  onToggleRename: (value: boolean) => void;
  onToggleSettings: (value: boolean) => void;
};

export function GameScreen(props: GameScreenProps) {
  return (
    <main className="game-shell">
      <header className="game-header">
        <button className="icon-button" type="button" onClick={props.onBackHome} aria-label="Về trang chủ"><Home size={19} /></button>
        <div className="room-heading"><strong>{props.room?.name || props.slug}</strong><span><Users size={14} /> {props.room ? props.room.players.filter((player) => player.status !== "left").length : 0}/{props.room?.maxPlayers || "-"}</span></div>
        <button className="icon-button" type="button" onClick={() => props.onToggleSettings(true)} aria-label="Cài đặt"><Settings size={19} /></button>
      </header>

      {props.room ? <><PlayerRail players={props.room.players} currentPlayerId={props.room.game.currentPlayerId} /><section className="turn-banner">{props.room.game.status === "waiting" && "Đang chờ thêm bạn. Cần ít nhất 2 người để bắt đầu."}{props.room.game.status === "playing" && <>Lượt của <strong> {props.currentPlayer?.displayName || "bạn tiếp theo"}</strong></>}{props.room.game.status === "ended" && "Ván chơi đã kết thúc"}</section><GameBoard room={props.room} me={props.me} canPlay={props.canPlay} onMove={props.onMove} /></> : <section className="loading-room"><Sparkles className="spin-soft" size={42} /><p>Đang tìm phòng...</p></section>}

      <HistorySheet open={props.showHistory} history={props.history} onClose={() => props.onToggleHistory(false)} />
      <RenameSheet open={props.showRename} value={props.renameName} onChange={props.onSetRenameName} onClose={() => props.onToggleRename(false)} onSubmit={props.onRename} />
      <SettingsSheet open={props.showSettings} canStart={Boolean(props.me?.isHost && props.room?.game.status !== "playing")} canCreateNewRound={Boolean(props.me?.isHost)} onClose={() => props.onToggleSettings(false)} onCopyLink={props.onCopyLink} onOpenHistory={() => { props.onToggleSettings(false); props.onToggleHistory(true); }} onOpenRename={() => { props.onToggleSettings(false); props.onOpenRename(); }} onStart={() => { props.onStart(); props.onToggleSettings(false); }} onNewRound={() => { props.onNewRound(); props.onToggleSettings(false); }} onLeave={props.onLeaveRoom} />
      {props.message && <Toast message={props.message} />}
    </main>
  );
}

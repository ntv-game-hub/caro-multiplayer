import { History, Plus, Send, Sparkles } from "lucide-react";
import type { HistoryEntry, RoomSummary } from "../../../shared/types";
import { HistorySheet, Toast } from "../components/Sheets";

type HomeScreenProps = {
  connected: boolean;
  history: HistoryEntry[];
  maxPlayers: number;
  message: string;
  playerName: string;
  roomName: string;
  rooms: RoomSummary[];
  showHistory: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (slug: string) => void;
  onSetMaxPlayers: (value: number) => void;
  onSetPlayerName: (value: string) => void;
  onSetRoomName: (value: string) => void;
  onToggleHistory: (value: boolean) => void;
};

export function HomeScreen(props: HomeScreenProps) {
  return (
    <main className="app-shell home-screen">
      <section className="home-top">
        <div><p className="eyebrow">Caro Multiplayer</p><h1>Caro Vui Vẻ</h1></div>
        <button className="icon-button" type="button" onClick={() => props.onToggleHistory(true)} aria-label="Lịch sử"><History size={20} /></button>
      </section>
      <section className="quick-panel">
        <label>Tên của bạn<input value={props.playerName} onChange={(event) => props.onSetPlayerName(event.target.value)} placeholder="Ví dụ: An" maxLength={24} /></label>
        <div className="create-grid">
          <label>Tên phòng<input value={props.roomName} onChange={(event) => props.onSetRoomName(event.target.value)} placeholder="Phòng cầu vồng" maxLength={36} /></label>
          <label>Mục tiêu số bạn<input value={props.maxPlayers} onChange={(event) => props.onSetMaxPlayers(Number(event.target.value))} type="number" min={2} max={8} /></label>
        </div>
        <button className="primary-button" type="button" onClick={props.onCreateRoom}><Plus size={18} /> Tạo phòng</button>
      </section>
      <section className="room-list">
        <div className="section-title"><h2>Phòng đang mở</h2><span className={props.connected ? "status-dot online" : "status-dot"}>{props.connected ? "Đang kết nối" : "Mất kết nối"}</span></div>
        {props.rooms.length === 0 ? <div className="empty-state"><Sparkles size={28} /><p>Chưa có phòng nào. Tạo một phòng thật xinh để mời bạn bè vào chơi nhé.</p></div> : props.rooms.map((item) => (
          <article className="room-card" key={item.slug}><div><h3>{item.name}</h3><p>{item.playerCount}/{item.maxPlayers} bạn · {item.status === "playing" ? "Đang chơi" : item.status === "ended" ? "Đã kết thúc" : "Đang chờ"}</p></div><button type="button" onClick={() => props.onJoinRoom(item.slug)}><Send size={17} /> Vào</button></article>
        ))}
      </section>
      <HistorySheet open={props.showHistory} history={props.history} onClose={() => props.onToggleHistory(false)} />
      {props.message && <Toast message={props.message} />}
    </main>
  );
}

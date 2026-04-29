import { Home, Send } from "lucide-react";
import { Toast } from "../components/Sheets";

type JoinGateScreenProps = {
  message: string;
  playerName: string;
  slug: string;
  onBackHome: () => void;
  onJoinRoom: (slug: string) => void;
  onSetPlayerName: (value: string) => void;
};

export function JoinGateScreen({ message, playerName, slug, onBackHome, onJoinRoom, onSetPlayerName }: JoinGateScreenProps) {
  return (
    <main className="app-shell join-screen">
      <button className="ghost-button" type="button" onClick={onBackHome}><Home size={17} /> Về danh sách</button>
      <section className="quick-panel">
        <p className="eyebrow">Phòng {slug}</p><h1>Nhập tên để vào chơi</h1>
        <label>Tên của bạn<input autoFocus value={playerName} onChange={(event) => onSetPlayerName(event.target.value)} placeholder="Ví dụ: Bình" /></label>
        <button className="primary-button" type="button" onClick={() => onJoinRoom(slug)}><Send size={18} /> Vào phòng</button>
      </section>
      {message && <Toast message={message} />}
    </main>
  );
}

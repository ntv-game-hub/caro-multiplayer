import { Clipboard, DoorOpen, History, Pencil, Play, RefreshCcw, Sparkles, X } from "lucide-react";
import type { HistoryEntry } from "../../../shared/types";

export function SettingsSheet({ open, canStart, canCreateNewRound, onClose, onCopyLink, onOpenHistory, onOpenRename, onStart, onNewRound, onLeave }: { open: boolean; canStart: boolean; canCreateNewRound: boolean; onClose: () => void; onCopyLink: () => void; onOpenHistory: () => void; onOpenRename: () => void; onStart: () => void; onNewRound: () => void; onLeave: () => void; }) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-title"><h2>Cài đặt</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>
        <div className="settings-actions">
          <button type="button" onClick={onCopyLink}><Clipboard size={18} /> Sao chép link</button>
          <button type="button" onClick={onOpenHistory}><History size={18} /> Lịch sử</button>
          <button type="button" onClick={onOpenRename}><Pencil size={18} /> Đổi tên</button>
          {canStart && <button type="button" onClick={onStart}><Play size={18} /> Bắt đầu</button>}
          {canCreateNewRound && <button type="button" onClick={onNewRound}><RefreshCcw size={18} /> Ván mới</button>}
          <button type="button" onClick={onLeave}><DoorOpen size={18} /> Rời phòng</button>
        </div>
      </section>
    </div>
  );
}

export function HistorySheet({ open, history, onClose }: { open: boolean; history: HistoryEntry[]; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-title"><h2>Lịch sử chơi</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>
        {history.length === 0 ? <p className="muted">Chưa có ván nào được lưu trên máy này.</p> : <div className="history-list">{history.map((item) => <article key={item.id}><strong>{item.roomName}</strong><span>{new Date(item.playedAt).toLocaleString("vi-VN")}</span><p>{item.result} · {item.moves} nước · {item.players.join(", ")}</p></article>)}</div>}
      </section>
    </div>
  );
}

export function RenameSheet({ open, value, onChange, onClose, onSubmit }: { open: boolean; value: string; onChange: (value: string) => void; onClose: () => void; onSubmit: () => void; }) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-title"><h2>Đổi tên</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></div>
        <form className="rename-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
          <label>Tên mới<input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder="Ví dụ: Minh Anh" maxLength={24} /></label>
          <button className="primary-button" type="submit"><Pencil size={18} /> Lưu tên</button>
        </form>
      </section>
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return <div className="toast"><Sparkles size={18} /><span>{message}</span></div>;
}

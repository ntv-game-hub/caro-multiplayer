import { Trophy } from "lucide-react";
import type { Player } from "../../../shared/types";
import { PlayerIcon } from "./PlayerIcon";

export function PlayerRail({ players, currentPlayerId }: { players: Player[]; currentPlayerId?: string }) {
  return (
    <section className="player-rail">
      {players.filter((player) => player.status !== "left").map((player) => (
        <div className={`player-pill ${player.id === currentPlayerId ? "active" : ""} ${player.status}`} key={player.id}>
          <span className="avatar" style={{ borderColor: player.color, backgroundColor: `${player.color}22` }}><PlayerIcon player={player} /></span>
          <span>{player.displayName}</span>
          {player.rank && <small><Trophy size={13} /> #{player.rank}</small>}
        </div>
      ))}
    </section>
  );
}

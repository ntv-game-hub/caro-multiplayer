import { Crown, Flower2, Heart, Moon, Rocket, Sparkles, Star, Sun } from "lucide-react";
import type { Player } from "../../../shared/types";

const iconMap = { star: Star, heart: Heart, sparkles: Sparkles, flower: Flower2, sun: Sun, moon: Moon, rocket: Rocket, crown: Crown };

export function PlayerIcon({ player, size = 18 }: { player: Pick<Player, "icon" | "color">; size?: number }) {
  const Icon = iconMap[player.icon as keyof typeof iconMap] || Star;
  return <Icon size={size} strokeWidth={2.8} style={{ color: player.color }} />;
}

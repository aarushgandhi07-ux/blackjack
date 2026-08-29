import type { PlayerHandView } from "@/lib/types";
import { handTotal } from "@/lib/cards";
import { PlayingCard } from "./PlayingCard";

interface HandDisplayProps {
  cards: string[];
  total: number;
  soft: boolean;
  label: string;
  active?: boolean;
  result?: PlayerHandView["resolved"];
  bet?: number;
  isDealer?: boolean;
  holeHidden?: boolean; // dealer hole card is face-down
}

const RESULT_STYLES: Record<string, { text: string; bg: string; label: string }> = {
  win: { text: "text-emerald-300", bg: "bg-emerald-500/20 border-emerald-400/40", label: "WIN" },
  lose: { text: "text-red-300", bg: "bg-red-500/20 border-red-400/40", label: "LOSE" },
  push: { text: "text-slate-300", bg: "bg-slate-500/20 border-slate-400/40", label: "PUSH" },
  blackjack: { text: "text-amber-300", bg: "bg-amber-500/20 border-amber-400/40", label: "BLACKJACK" },
  none: { text: "", bg: "", label: "" },
};

export function HandDisplay({
  cards,
  total,
  soft,
  label,
  active = false,
  result = "none",
  bet,
  isDealer = false,
  holeHidden = false,
}: HandDisplayProps) {
  const style = RESULT_STYLES[result] ?? RESULT_STYLES.none;

  // For the dealer with a hidden hole card: show up card + face-down card.
  // The server sends only the up card in dealer_cards when hole is hidden,
  // so we render the up card plus a face-down placeholder.
  const renderCards = () => {
    if (isDealer && holeHidden && cards.length >= 1) {
      return (
        <div className="flex gap-1.5 sm:gap-2 items-center">
          <PlayingCard card={cards[0]} index={0} />
          <PlayingCard card={null} index={1} isHole />
        </div>
      );
    }
    return (
      <div className="flex gap-1.5 sm:gap-2 items-center">
        {cards.map((card, i) => (
          <PlayingCard key={i} card={card} index={i} />
        ))}
      </div>
    );
  };

  return (
    <div className={`flex flex-col items-center gap-2 transition-all ${active ? "scale-105" : ""}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium uppercase tracking-wider ${active ? "text-emerald-400" : "text-slate-500"}`}>
          {label}
        </span>
        {bet !== undefined && (
          <span className="text-xs text-amber-400/80 font-semibold">₹{bet}</span>
        )}
      </div>

      {renderCards()}

      {cards.length > 0 && (
        <div className={`px-3 py-1 rounded-full text-sm font-bold border ${
          result !== "none" ? style.bg : "bg-slate-800/60 border-slate-700/50"
        } ${result !== "none" ? style.text : total > 21 ? "text-red-400" : "text-white"}`}>
          {holeHidden && isDealer
            ? `${handTotal([cards[0]]).total} + ?`
            : total > 21
            ? "Bust"
            : `${total}${soft && total !== 21 ? " (soft)" : ""}`}
          {result !== "none" && ` · ${style.label}`}
        </div>
      )}
    </div>
  );
}

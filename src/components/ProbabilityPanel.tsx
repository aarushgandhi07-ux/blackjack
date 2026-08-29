import { useMemo } from "react";
import { computeProbabilities, pct } from "@/lib/probability";
import { handTotal } from "@/lib/cards";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { RoundView } from "@/lib/types";

interface ProbabilityPanelProps {
  round: RoundView;
  dealtCards: string[];
}

export function ProbabilityPanel({ round, dealtCards }: ProbabilityPanelProps) {
  const probs = useMemo(() => {
    const activeHand = round.player_hands[round.active_hand_index];
    if (!activeHand || activeHand.cards.length < 2) return null;

    const playerTotal = handTotal(activeHand.cards).total;
    if (playerTotal >= 21) return null;

    const dealerUp = round.dealer_cards[0];
    // Dealer hole card is known only when revealed (resolved or dealer_hidden=false).
    const dealerHole = round.dealer_cards.length > 1 && (round.phase === "resolved" || round.player_hands[0].resolved !== "none")
      ? round.dealer_cards[1]
      : null;

    return computeProbabilities(activeHand.cards, dealerUp, dealerHole, dealtCards);
  }, [round, dealtCards]);

  if (!probs || round.phase !== "player_turn") return null;

  const hitBetter = probs.hitWin > probs.standWin;

  return (
    <div className="bg-slate-900/70 backdrop-blur-md rounded-xl border border-slate-700/50 p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5" />
        Win Probability
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-lg p-3 border transition-all ${hitBetter ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-700/50 bg-slate-800/40"}`}>
          <div className="flex items-center gap-1.5 mb-1">
            {hitBetter ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-slate-500" />}
            <span className="text-xs text-slate-400">If you HIT</span>
          </div>
          <div className={`text-xl font-bold ${hitBetter ? "text-emerald-300" : "text-slate-300"}`}>
            {pct(probs.hitWin)}
          </div>
          {probs.hitBust > 0 && (
            <div className="text-[10px] text-red-400/80 mt-0.5">Bust risk: {pct(probs.hitBust)}</div>
          )}
        </div>
        <div className={`rounded-lg p-3 border transition-all ${!hitBetter ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-700/50 bg-slate-800/40"}`}>
          <div className="flex items-center gap-1.5 mb-1">
            {!hitBetter ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <Minus className="w-3.5 h-3.5 text-slate-500" />}
            <span className="text-xs text-slate-400">If you STAND</span>
          </div>
          <div className={`text-xl font-bold ${!hitBetter ? "text-emerald-300" : "text-slate-300"}`}>
            {pct(probs.standWin)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Push: {pct(probs.standPush)}</div>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 mt-2.5 leading-relaxed">
        Calculated from {dealtCards.length} cards dealt · {round.player_hands[0] ? "live shoe enumeration" : ""}
      </p>
    </div>
  );
}

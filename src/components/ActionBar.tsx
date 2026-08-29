import { canSplit, canDouble, handTotal } from "@/lib/cards";
import type { RoundView, GameState } from "@/lib/types";
import { Plus, Square, ChevronsUp, Split, Shield } from "lucide-react";

interface ActionBarProps {
  round: RoundView;
  state: GameState;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onInsurance: (bet: number) => void;
  onSkipInsurance: () => void;
  loading: boolean;
}

export function ActionBar({
  round,
  state,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onInsurance,
  onSkipInsurance,
  loading,
}: ActionBarProps) {
  // Insurance phase
  if (round.phase === "insurance") {
    const maxIns = Math.floor(round.bet / 2);
    return (
      <div className="flex flex-col items-center gap-3 p-4">
        <div className="flex items-center gap-2 text-amber-300">
          <Shield className="w-5 h-5" />
          <span className="font-semibold">Insurance? Dealer shows an Ace</span>
        </div>
        <p className="text-xs text-slate-400 text-center max-w-md">
          Pay up to ₹{maxIns} (half your bet). If dealer has blackjack, insurance pays 2:1.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => onInsurance(maxIns)}
            disabled={loading || (state.balance ?? 0) < maxIns}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-semibold rounded-xl transition-all active:scale-95"
          >
            <Shield className="w-4 h-4" />
            Insure ₹{maxIns}
          </button>
          <button
            onClick={onSkipInsurance}
            disabled={loading}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all active:scale-95"
          >
            No Insurance
          </button>
        </div>
      </div>
    );
  }

  if (round.phase !== "player_turn") return null;

  const hand = round.player_hands[round.active_hand_index];
  if (!hand) return null;

  const splitAllowed = round.player_hands.length === 1 && canSplit(hand.cards) && (state.balance ?? 0) >= hand.bet;
  const doubleAllowed = canDouble(hand.cards) && !hand.doubled && (state.balance ?? 0) >= hand.bet;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 p-4">
      <button
        onClick={onHit}
        disabled={loading}
        className="flex items-center gap-2 px-5 sm:px-7 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
      >
        <Plus className="w-4 h-4" />
        Hit
      </button>
      <button
        onClick={onStand}
        disabled={loading}
        className="flex items-center gap-2 px-5 sm:px-7 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white font-semibold rounded-xl transition-all active:scale-95"
      >
        <Square className="w-4 h-4" />
        Stand
      </button>
      {doubleAllowed && (
        <button
          onClick={onDouble}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-all active:scale-95"
        >
          <ChevronsUp className="w-4 h-4" />
          Double
        </button>
      )}
      {splitAllowed && (
        <button
          onClick={onSplit}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-all active:scale-95"
        >
          <Split className="w-4 h-4" />
          Split
        </button>
      )}
    </div>
  );
}

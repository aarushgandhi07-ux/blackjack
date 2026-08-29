import { useState } from "react";
import { Coins } from "lucide-react";

interface BettingPanelProps {
  stake: number;
  balance: number;
  onDeal: (bet: number) => void;
  loading: boolean;
}

const CHIP_VALUES = [1, 5, 10, 25, 100];

export function BettingPanel({ stake, balance, onDeal, loading }: BettingPanelProps) {
  const [bet, setBet] = useState(stake);
  const maxBet = Math.min(balance, stake * 25);

  const addChip = (val: number) => {
    setBet((prev) => Math.min(prev + val, maxBet));
  };

  const canDeal = bet >= stake && bet <= balance && !loading;

  return (
    <div className="flex flex-col items-center gap-5 p-4">
      <div className="text-center">
        <p className="text-sm text-slate-400 mb-1">Place your bet</p>
        <p className="text-xs text-slate-500">Minimum ₹{stake} · Maximum ₹{maxBet.toLocaleString()}</p>
      </div>

      {/* Bet display */}
      <div className="flex items-center gap-3 bg-slate-900/70 backdrop-blur-md rounded-2xl border border-amber-500/30 px-6 py-4">
        <Coins className="w-6 h-6 text-amber-400" />
        <span className="text-3xl font-bold text-amber-300">₹{bet.toLocaleString()}</span>
      </div>

      {/* Chip buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {CHIP_VALUES.map((val) => {
          const actualVal = val * stake;
          if (actualVal > maxBet && val > 1) return null;
          return (
            <button
              key={val}
              onClick={() => addChip(actualVal)}
              disabled={loading}
              className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: `radial-gradient(circle at 30% 30, ${getChipColor(val)}, ${getChipColor(val)}dd)`,
                boxShadow: `0 4px 12px ${getChipColor(val)}44, inset 0 0 0 4px rgba(255,255,255,0.15)`,
              }}
            >
              <span className="absolute inset-1.5 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center">
                <span className="text-white font-bold text-sm drop-shadow">
                  {val > 1 ? `×${val}` : "1×"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Quick bet buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setBet(stake)}
          disabled={loading}
          className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 rounded-lg transition-all disabled:opacity-50"
        >
          Min
        </button>
        <button
          onClick={() => setBet(Math.floor(maxBet / 2))}
          disabled={loading}
          className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 rounded-lg transition-all disabled:opacity-50"
        >
          Half
        </button>
        <button
          onClick={() => setBet(maxBet)}
          disabled={loading}
          className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 rounded-lg transition-all disabled:opacity-50"
        >
          Max
        </button>
        <button
          onClick={() => setBet(stake * 2)}
          disabled={loading || stake * 2 > maxBet}
          className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 rounded-lg transition-all disabled:opacity-50"
        >
          2× Stake
        </button>
      </div>

      {/* Deal button */}
      <button
        onClick={() => onDeal(bet)}
        disabled={!canDeal}
        className="px-10 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg rounded-2xl transition-all shadow-xl shadow-emerald-500/30 active:scale-[0.98]"
      >
        {loading ? "Dealing..." : "Deal"}
      </button>
    </div>
  );
}

function getChipColor(val: number): string {
  switch (val) {
    case 1: return "#ef4444";
    case 5: return "#3b82f6";
    case 10: return "#10b981";
    case 25: return "#8b5cf6";
    case 100: return "#f59e0b";
    default: return "#64748b";
  }
}

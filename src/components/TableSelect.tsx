import { VALID_STAKES, type Stake } from "@/lib/types";
import { Spade, Lock } from "lucide-react";

interface TableSelectProps {
  balance: number;
  onSelect: (stake: Stake) => void;
}

const TABLE_INFO: Record<number, { name: string; desc: string }> = {
  10: { name: "Bronze", desc: "Casual play" },
  20: { name: "Silver", desc: "Steady action" },
  100: { name: "Gold", desc: "High roller" },
  1000: { name: "Platinum", desc: "VIP tables" },
};

export function TableSelect({ balance, onSelect }: TableSelectProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 mb-4">
          <Spade className="w-7 h-7 text-emerald-300" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Choose Your Table</h2>
        <p className="text-slate-400 mt-2 text-sm">
          Balance: <span className="text-emerald-300 font-semibold">₹{balance.toLocaleString()}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {VALID_STAKES.map((stake) => {
          const info = TABLE_INFO[stake];
          const affordable = balance >= stake;
          return (
            <button
              key={stake}
              disabled={!affordable}
              onClick={() => onSelect(stake)}
              className={`group relative overflow-hidden rounded-2xl border p-6 text-left transition-all ${
                affordable
                  ? "border-slate-700 bg-slate-900/60 hover:border-emerald-500/50 hover:bg-slate-800/60 cursor-pointer active:scale-[0.98]"
                  : "border-slate-800 bg-slate-900/30 opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">{info.name}</div>
                  <div className="text-3xl font-bold text-white mt-1">
                    ₹{stake}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">{info.desc}</div>
                </div>
                {!affordable && (
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800">
                    <Lock className="w-4 h-4 text-slate-500" />
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-500">
                Minimum balance: <span className={affordable ? "text-emerald-400" : "text-red-400"}>₹{stake}</span>
              </div>
              {affordable && (
                <div className="mt-3 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full transition-all group-hover:from-emerald-400 group-hover:to-emerald-200"
                    style={{ width: `${Math.min(100, (stake / balance) * 100)}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { Wallet, Layers, RotateCw, LogOut, Gift, Clock } from "lucide-react";
import type { GameState } from "@/lib/types";

interface HUDProps {
  state: GameState;
  onSignOut: () => void;
  onNewSession: () => void;
  onClaimBonus: () => void;
  bonusLoading: boolean;
}

export function HUD({ state, onSignOut, onNewSession, onClaimBonus, bonusLoading }: HUDProps) {
  return (
    <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-3 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-1.5">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 leading-none">Balance</span>
            <span className="text-sm font-bold text-emerald-300 leading-tight">
              ₹{state.balance?.toLocaleString() ?? "—"}
            </span>
          </div>
        </div>

        {state.round && (
          <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-1.5">
            <span className="text-[10px] text-slate-500 leading-none">Bet</span>
            <span className="text-sm font-bold text-amber-300 leading-tight">
              ₹{state.round.bet.toLocaleString()}
            </span>
          </div>
        )}

        <div className="hidden sm:flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-1.5">
          <Layers className="w-4 h-4 text-sky-400" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 leading-none">Shoe</span>
            <span className="text-sm font-bold text-sky-300 leading-tight">
              {state.shoe_remaining}/{state.initial_shoe_size || 208}
            </span>
          </div>
        </div>

        {state.stake > 0 && (
          <div className="hidden md:flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-1.5">
            <span className="text-[10px] text-slate-500 leading-none">Table</span>
            <span className="text-sm font-bold text-slate-200 leading-tight">₹{state.stake}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Daily bonus button */}
        {state.bonus_available ? (
          <button
            onClick={onClaimBonus}
            disabled={bonusLoading}
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 rounded-lg px-3 py-1.5 transition-all animate-[fadeIn_0.3s_ease-out] active:scale-95"
          >
            <Gift className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Claim ₹1,000</span>
            <span className="sm:hidden">₹1K</span>
          </button>
        ) : (
          state.hours_until_bonus > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/40 rounded-lg px-3 py-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bonus in {state.hours_until_bonus}h</span>
              <span className="sm:hidden">{state.hours_until_bonus}h</span>
            </div>
          )
        )}

        {state.stake > 0 && (
          <button
            onClick={onNewSession}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 rounded-lg px-3 py-1.5 transition-all"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Table</span>
          </button>
        )}
        <button
          onClick={onSignOut}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-300 bg-slate-800/60 hover:bg-red-500/10 rounded-lg px-3 py-1.5 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </div>
  );
}

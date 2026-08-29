import type { GameState } from "@/lib/types";
import { HandDisplay } from "./HandDisplay";
import { ProbabilityPanel } from "./ProbabilityPanel";
import { ActionBar } from "./ActionBar";
import { ResultBanner } from "./ResultBanner";
import { BettingPanel } from "./BettingPanel";

interface GameTableProps {
  state: GameState;
  dealtCards: string[];
  loading: boolean;
  onDeal: (bet: number) => void;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onInsurance: (bet: number) => void;
  onSkipInsurance: () => void;
  onContinue: () => void;
}

export function GameTable({
  state,
  dealtCards,
  loading,
  onDeal,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onInsurance,
  onSkipInsurance,
  onContinue,
}: GameTableProps) {
  const { round, balance, stake } = state;

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-emerald-900 via-emerald-950 to-slate-950 relative overflow-hidden">
      {/* Felt texture overlay — radial vignette like a real table */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(ellipse at center top, rgba(16,185,129,0.15) 0%, transparent 60%), radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.5) 100%)`,
        }}
      />

      {/* Table content */}
      <div className="relative flex-1 flex flex-col">
        {/* Dealer area */}
        {round && (
          <div className="pt-8 pb-3 px-4">
            <div className="flex flex-col items-center">
              {/* Dealer label badge */}
              <div className="mb-2 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-700/50">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Dealer
                </span>
              </div>
              <HandDisplay
                cards={round.dealer_cards}
                total={round.dealer_total}
                soft={false}
                label=""
                isDealer
                holeHidden={round.dealer_hole_hidden}
              />
            </div>
          </div>
        )}

        {/* Center divider line — like the table's betting line */}
        {round && (
          <div className="flex items-center gap-3 px-8 py-1 opacity-30">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
          </div>
        )}

        {/* Center: probability or betting */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-2">
          {!round && balance !== null && (
            <BettingPanel
              stake={stake}
              balance={balance}
              onDeal={onDeal}
              loading={loading}
            />
          )}

          {round && round.phase === "player_turn" && (
            <div className="w-full max-w-md">
              <ProbabilityPanel round={round} dealtCards={dealtCards} />
            </div>
          )}

          {round && round.phase === "resolved" && (
            <ResultBanner round={round} onContinue={onContinue} />
          )}

          {round && round.phase === "insurance" && (
            <div className="w-full max-w-md text-center">
              <p className="text-slate-400 text-sm">Dealer is checking for blackjack...</p>
            </div>
          )}
        </div>

        {/* Player area */}
        {round && (
          <div className="pb-3 pt-2 px-4">
            <div className="flex flex-col items-center gap-4">
              {round.player_hands.map((hand, i) => (
                <HandDisplay
                  key={i}
                  cards={hand.cards}
                  total={hand.total}
                  soft={hand.soft}
                  label={round.player_hands.length > 1 ? `Hand ${i + 1}` : "You"}
                  active={i === round.active_hand_index && round.phase === "player_turn"}
                  result={hand.resolved}
                  bet={hand.bet}
                />
              ))}
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="pb-4">
          {round && (
            <ActionBar
              round={round}
              state={state}
              onHit={onHit}
              onStand={onStand}
              onDouble={onDouble}
              onSplit={onSplit}
              onInsurance={onInsurance}
              onSkipInsurance={onSkipInsurance}
              loading={loading}
            />
          )}
        </div>
      </div>

      {/* Mobile shoe indicator */}
      <div className="sm:hidden flex items-center justify-center gap-2 pb-2 text-xs text-slate-500">
        <span>Shoe: {state.shoe_remaining}/{state.initial_shoe_size || 208} cards</span>
        {state.round_count > 0 && <span>· Round #{state.round_count}</span>}
      </div>
    </div>
  );
}

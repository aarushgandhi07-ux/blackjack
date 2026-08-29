import { AuthProvider, useAuth } from "@/lib/auth";
import { useGame } from "@/lib/useGame";
import { AuthScreen } from "@/components/AuthScreen";
import { HUD } from "@/components/HUD";
import { TableSelect } from "@/components/TableSelect";
import { GameTable } from "@/components/GameTable";
import type { Stake } from "@/lib/types";

function GameApp() {
  const { user, loading: authLoading, signOut } = useAuth();
  const game = useGame();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNewSession = async (stake: Stake) => {
    await game.newSession(stake);
  };

  const handleBackToTables = async () => {
    // Clear current session state to show table selection
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <HUD
        state={game.state}
        onSignOut={handleSignOut}
        onNewSession={handleBackToTables}
        onClaimBonus={game.claimDailyBonus}
        bonusLoading={game.loading}
      />

      {game.error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-[fadeIn_0.2s_ease-out]">
          {game.error}
          <button
            onClick={game.clearError}
            className="ml-3 text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {game.state.stake === 0 ? (
        <TableSelect
          balance={game.state.balance ?? 10000}
          onSelect={handleNewSession}
        />
      ) : (
        <GameTable
          state={game.state}
          dealtCards={game.dealtCards}
          loading={game.loading}
          onDeal={game.deal}
          onHit={game.hit}
          onStand={game.stand}
          onDouble={game.double}
          onSplit={game.split}
          onInsurance={game.insurance}
          onSkipInsurance={game.skipInsurance}
          onContinue={() => game.refreshState()}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GameApp />
    </AuthProvider>
  );
}

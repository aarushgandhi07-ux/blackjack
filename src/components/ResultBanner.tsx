import type { RoundView } from "@/lib/types";

interface ResultBannerProps {
  round: RoundView;
  onContinue: () => void;
}

export function ResultBanner({ round, onContinue }: ResultBannerProps) {
  if (round.phase !== "resolved") return null;

  const hands = round.player_hands;
  const totalBet = hands.reduce((s, h) => s + h.bet, 0);
  const totalPayout = hands.reduce((s, h) => s + h.payout, 0);
  const net = totalPayout - totalBet;

  let title = "Push";
  let subtitle = "Your bet is returned";
  let color = "text-slate-300";
  let bg = "from-slate-700/40 to-slate-800/40";
  let border = "border-slate-500/30";

  if (hands.length === 1) {
    const r = hands[0].resolved;
    if (r === "blackjack") {
      title = "Blackjack!";
      subtitle = `Paid 3:2 · +₹${Math.abs(net).toLocaleString()}`;
      color = "text-amber-300";
      bg = "from-amber-500/20 to-amber-600/10";
      border = "border-amber-400/40";
    } else if (r === "win") {
      title = "You Win!";
      subtitle = `+₹${Math.abs(net).toLocaleString()}`;
      color = "text-emerald-300";
      bg = "from-emerald-500/20 to-emerald-600/10";
      border = "border-emerald-400/40";
    } else if (r === "lose") {
      title = "Dealer Wins";
      subtitle = `-₹${Math.abs(net).toLocaleString()}`;
      color = "text-red-300";
      bg = "from-red-500/20 to-red-600/10";
      border = "border-red-400/40";
    }
  } else {
    if (net > 0) {
      title = "You Win!";
      subtitle = `+₹${net.toLocaleString()} across ${hands.length} hands`;
      color = "text-emerald-300";
      bg = "from-emerald-500/20 to-emerald-600/10";
      border = "border-emerald-400/40";
    } else if (net < 0) {
      title = "Dealer Wins";
      subtitle = `-₹${Math.abs(net).toLocaleString()} across ${hands.length} hands`;
      color = "text-red-300";
      bg = "from-red-500/20 to-red-600/10";
      border = "border-red-400/40";
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4 animate-[fadeIn_0.3s_ease-out]">
      <div className={`bg-gradient-to-r ${bg} border ${border} rounded-2xl px-8 py-5 text-center backdrop-blur-md`}>
        <h2 className={`text-2xl sm:text-3xl font-bold ${color}`}>{title}</h2>
        <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
      </div>
      <button
        onClick={onContinue}
        className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/30 active:scale-95"
      >
        Next Hand
      </button>
    </div>
  );
}

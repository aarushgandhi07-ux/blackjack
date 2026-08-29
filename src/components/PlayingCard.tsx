import { SUIT_SYMBOLS, SUIT_COLORS, displayRank } from "@/lib/cards";

interface PlayingCardProps {
  card: string | null; // null = face-down card
  index?: number;
  animate?: boolean;
  isHole?: boolean; // true = this is the dealer's hole card (face-down)
}

export function PlayingCard({ card, index = 0, animate = true, isHole = false }: PlayingCardProps) {
  if (!card) {
    return (
      <div
        className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg shadow-lg overflow-hidden"
        style={animate ? { animation: `dealCard 0.35s ease-out ${index * 0.12}s both` } : undefined}
      >
        {/* Card back — deep emerald with diamond pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-900 border border-emerald-700/60" />
        {/* Diamond lattice pattern */}
        <div
          className="absolute inset-1 rounded-md border border-emerald-500/30"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(16,185,129,0.12) 5px, rgba(16,185,129,0.12) 6px), repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(16,185,129,0.12) 5px, rgba(16,185,129,0.12) 6px)`,
          }}
        />
        {/* Center emblem */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 ${isHole ? "border-amber-400/50" : "border-emerald-400/40"} flex items-center justify-center bg-emerald-950/60`}>
            <span className={`text-xs sm:text-sm font-bold ${isHole ? "text-amber-300/70" : "text-emerald-300/70"}`}>
              {isHole ? "?" : "♠"}
            </span>
          </div>
        </div>
        {/* Corner accents */}
        <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-emerald-400/30 rounded-tl" />
        <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-emerald-400/30 rounded-tr" />
        <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-emerald-400/30 rounded-bl" />
        <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-emerald-400/30 rounded-br" />
      </div>
    );
  }

  const rank = displayRank(card);
  const suit = card[1];
  const symbol = SUIT_SYMBOLS[suit] ?? "";
  const colorClass = SUIT_COLORS[suit] ?? "text-slate-900";

  return (
    <div
      className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-white shadow-lg border border-slate-300 flex flex-col justify-between p-1.5 sm:p-2"
      style={animate ? { animation: `dealCard 0.35s ease-out ${index * 0.12}s both` } : undefined}
    >
      <div className={`text-sm sm:text-lg font-bold leading-none ${colorClass}`}>
        {rank}
        <span className="block text-xs sm:text-sm">{symbol}</span>
      </div>
      <div className={`text-2xl sm:text-3xl text-center ${colorClass}`}>
        {symbol}
      </div>
      <div className={`text-sm sm:text-lg font-bold leading-none text-right rotate-180 ${colorClass}`}>
        {rank}
        <span className="block text-xs sm:text-sm">{symbol}</span>
      </div>
    </div>
  );
}

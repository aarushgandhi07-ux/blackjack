// Card and hand evaluation utilities (client-side display + probability).
// The server is authoritative for all game logic; these helpers mirror the
// server's evaluation so the UI can display totals and compute probabilities
// from the publicly visible shoe composition.

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"];
export const SUITS = ["S", "H", "D", "C"];
export const SUIT_SYMBOLS: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const SUIT_COLORS: Record<string, string> = { S: "text-slate-900", H: "text-red-600", D: "text-red-600", C: "text-slate-900" };

export function rankOf(card: string): string {
  return card[0];
}

export function suitOf(card: string): string {
  return card[1];
}

export function displayRank(card: string): string {
  const r = rankOf(card);
  return r === "T" ? "10" : r;
}

export function cardValue(card: string): number {
  const r = rankOf(card);
  if (r === "A") return 11;
  if (r === "T" || r === "J" || r === "Q" || r === "K") return 10;
  return parseInt(r, 10);
}

export interface HandTotal {
  total: number;
  soft: boolean;
}

export function handTotal(cards: string[]): HandTotal {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (rankOf(c) === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  const soft = aces > 0 && total <= 21;
  return { total, soft };
}

export function isBlackjack(cards: string[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21;
}

export function isBust(cards: string[]): boolean {
  return handTotal(cards).total > 21;
}

export function canSplit(cards: string[]): boolean {
  return cards.length === 2 && cardValue(cards[0]) === cardValue(cards[1]);
}

export function canDouble(cards: string[]): boolean {
  return cards.length === 2;
}

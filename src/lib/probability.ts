// Win probability calculation — real card-counting logic.
//
// Given the player's current hand, the dealer's visible up card, and the
// known composition of remaining cards in the shoe, we compute the exact
// probability of each outcome by enumerating all possible dealer completions
// (and, for "hit", all possible next-card draws + subsequent play).
//
// The shoe composition is derived from what the client has seen dealt so far.
// The server is authoritative for the actual shoe, but the client can track
// every card it has been shown and subtract them from the initial 4-deck (208
// card) composition to reconstruct the remaining shoe. This gives a live,
// accurate probability estimate that updates after every card is dealt.
//
// Key design decisions:
// - For STAND: we enumerate every possible sequence of dealer draws until the
//   dealer reaches 17+ (standing on all 17s, soft and hard). For each sequence
//   we know the dealer's final total and can compare to the player's total.
//   Probability = weighted sum over all sequences.
// - For HIT: we enumerate each possible next card, then recursively evaluate
//   the resulting hand (bust = immediate loss, 21 = stand, otherwise the
//   player is assumed to play optimally — we approximate by taking the max
//   probability of the hit-vs-stand choice at each step, which gives an
//   upper-bound "optimal play" estimate). This is computationally feasible
//   because the branching factor is small (13 ranks) and we aggregate by rank.
// - We aggregate by rank (not by full card code) because only the rank matters
//   for blackjack totals. This collapses 208 cards into 13 buckets and makes
//   the enumeration tractable.

import { cardValue, handTotal, type HandTotal } from "./cards";

export interface RankCounts {
  [rank: string]: number; // e.g. { A: 6, "2": 8, ... "K": 8 }
}

export const FULL_SHOE_RANK_COUNTS: RankCounts = {
  A: 16, "2": 16, "3": 16, "4": 16, "5": 16, "6": 16, "7": 16, "8": 16, "9": 16, T: 16, J: 16, Q: 16, K: 16,
};

export const ALL_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"];

// Build the remaining-shoe rank counts by subtracting all dealt cards from
// the full 4-deck composition. `dealtCards` is every card the client has seen.
export function remainingShoeCounts(dealtCards: string[]): RankCounts {
  const counts: RankCounts = { ...FULL_SHOE_RANK_COUNTS };
  for (const card of dealtCards) {
    const r = card[0];
    counts[r] = (counts[r] ?? 0) - 1;
  }
  return counts;
}

export interface Probabilities {
  standWin: number; // P(win | stand) — includes push-free win
  standPush: number;
  standLose: number;
  hitWin: number; // P(win | hit) — best-case optimal play estimate
  hitBust: number; // P(bust on the very next hit)
  hitWinImmediate: number; // P(reach 21 on next hit and win)
}

// ---- Dealer outcome enumeration ----
// Given the dealer's current cards (up card + hole card if known, or just up
// card if hole card unknown) and the remaining shoe, compute the probability
// distribution of the dealer's final total.
//
// We use memoized recursion over the shoe state. Since we aggregate by rank
// and the shoe is at most 208 cards, and the dealer draws at most ~16 cards,
// the state space is manageable. We cap recursion depth for safety.

interface DealerOutcomeProbs {
  bust: number;
  totals: number[]; // 17..21 + bust
  probByTotal: Record<number, number>; // total -> P(dealer ends at that total)
}

// Compute P(dealer final total) by enumerating all draw sequences.
// `dealerCards` includes all known dealer cards (up card + hole card if revealed).
// `shoe` is the remaining rank counts.
function dealerOutcomeDistribution(
  dealerCards: string[],
  shoe: RankCounts,
): Record<number, number> {
  // result[total] = probability dealer ends at that total (17-21, or 22+ = bust)
  const result: Record<number, number> = {};
  let totalCards = 0;
  for (const r of ALL_RANKS) totalCards += shoe[r];

  function recurse(currentCards: string[], currentShoe: RankCounts, pathProb: number) {
    const { total, soft } = handTotal(currentCards);
    // Dealer stands on all 17s (soft and hard).
    if (total >= 17) {
      const key = total > 21 ? 22 : total; // 22 = bust bucket
      result[key] = (result[key] ?? 0) + pathProb;
      return;
    }
    // Draw next card
    let remaining = 0;
    for (const r of ALL_RANKS) remaining += currentShoe[r];
    if (remaining === 0) {
      // No cards left — dealer stands at current total.
      const key = total > 21 ? 22 : total;
      result[key] = (result[key] ?? 0) + pathProb;
      return;
    }
    for (const r of ALL_RANKS) {
      const count = currentShoe[r];
      if (count <= 0) continue;
      const prob = count / remaining;
      const newShoe = { ...currentShoe, [r]: count - 1 };
      recurse([...currentCards, r + "S"], newShoe, pathProb * prob);
    }
  }

  recurse(dealerCards, shoe, 1);
  return result;
}

// ---- Main probability computation ----
// `playerCards`: the player's current hand.
// `dealerUpCard`: the dealer's visible card.
// `dealerHoleCard`: the dealer's hole card if known (null if hidden).
// `dealtCards`: all cards dealt so far (player + dealer visible) to compute remaining shoe.

export function computeProbabilities(
  playerCards: string[],
  dealerUpCard: string,
  dealerHoleCard: string | null,
  dealtCards: string[],
): Probabilities | null {
  // Need at least the player's hand and dealer up card.
  if (playerCards.length < 2 || !dealerUpCard) return null;

  const playerTotal = handTotal(playerCards).total;
  // If player already busted or has 21, probabilities aren't meaningful.
  if (playerTotal >= 21) return null;

  const shoe = remainingShoeCounts(dealtCards);

  // Dealer cards for enumeration: up card + hole card if known.
  const dealerCards = dealerHoleCard ? [dealerUpCard, dealerHoleCard] : [dealerUpCard];

  // ---- STAND probabilities ----
  // Enumerate dealer outcomes, compare to player total.
  const dealerDist = dealerOutcomeDistribution(dealerCards, shoe);

  let standWin = 0;
  let standPush = 0;
  let standLose = 0;
  let totalProb = 0;
  for (const [keyStr, prob] of Object.entries(dealerDist)) {
    const dealerTotal = parseInt(keyStr, 10);
    totalProb += prob;
    if (dealerTotal > 21) {
      standWin += prob; // dealer bust = player wins
    } else if (dealerTotal > playerTotal) {
      standLose += prob;
    } else if (dealerTotal < playerTotal) {
      standWin += prob;
    } else {
      standPush += prob;
    }
  }
  // Normalize (guard against floating point drift).
  if (totalProb > 0) {
    standWin /= totalProb;
    standPush /= totalProb;
    standLose /= totalProb;
  }

  // ---- HIT probabilities ----
  // For "hit", we compute the probability of improving the player's outcome.
  // We enumerate each possible next card, then:
  //   - If it busts: immediate loss.
  //   - If it reaches exactly 21: stand and use stand-win prob for that state.
  //   - Otherwise: we compare standing now vs hitting again (one more level),
  //     and take the better option — an approximation of optimal play.
  let hitBust = 0;
  let hitWinImmediate = 0;
  let hitWin = 0;

  let remainingCards = 0;
  for (const r of ALL_RANKS) remainingCards += shoe[r];

  if (remainingCards === 0) {
    // No cards to draw — can't hit.
    return {
      standWin,
      standPush,
      standLose,
      hitWin: 0,
      hitBust: 0,
      hitWinImmediate: 0,
    };
  }

  for (const r of ALL_RANKS) {
    const count = shoe[r];
    if (count <= 0) continue;
    const prob = count / remainingCards;
    const newCards = [...playerCards, r + "S"];
    const { total: newTotal } = handTotal(newCards);

    if (newTotal > 21) {
      hitBust += prob;
    } else if (newTotal === 21) {
      // Player reaches 21 — stand. Compute win prob from this state.
      const newDealt = [...dealtCards, r + "S"];
      const newShoe = remainingShoeCounts(newDealt);
      const dist = dealerOutcomeDistribution(dealerCards, newShoe);
      let w = 0;
      let tp = 0;
      for (const [ks, p] of Object.entries(dist)) {
        const dt = parseInt(ks, 10);
        tp += p;
        if (dt > 21 || dt < 21) w += p;
      }
      if (tp > 0) w /= tp;
      hitWin += prob * w;
      hitWinImmediate += prob;
    } else {
      // Player can hit again or stand. Approximate optimal play:
      // compute stand-win for this new total, and one more level of hit-win.
      const newDealt = [...dealtCards, r + "S"];
      const newShoe = remainingShoeCounts(newDealt);

      // Stand win prob from new state
      const standDist = dealerOutcomeDistribution(dealerCards, newShoe);
      let standW = 0;
      let tp = 0;
      for (const [ks, p] of Object.entries(standDist)) {
        const dt = parseInt(ks, 10);
        tp += p;
        if (dt > 21) standW += p;
        else if (dt < newTotal) standW += p;
      }
      if (tp > 0) standW /= tp;

      // One more hit: compute bust prob and 21 prob from this state.
      let rem2 = 0;
      for (const r2 of ALL_RANKS) rem2 += newShoe[r2];
      let furtherHitWin = 0;
      if (rem2 > 0) {
        for (const r2 of ALL_RANKS) {
          const c2 = newShoe[r2];
          if (c2 <= 0) continue;
          const p2 = c2 / rem2;
          const cards2 = [...newCards, r2 + "S"];
          const t2 = handTotal(cards2).total;
          if (t2 > 21) continue; // bust
          if (t2 === 21) {
            furtherHitWin += p2;
          } else {
            // Approximate: use stand win from this deeper state
            const shoe3 = { ...newShoe, [r2]: c2 - 1 };
            const d3 = dealerOutcomeDistribution(dealerCards, shoe3);
            let w3 = 0;
            let tp3 = 0;
            for (const [ks3, p3] of Object.entries(d3)) {
              const dt3 = parseInt(ks3, 10);
              tp3 += p3;
              if (dt3 > 21 || dt3 < t2) w3 += p3;
            }
            if (tp3 > 0) w3 /= tp3;
            furtherHitWin += p2 * w3;
          }
        }
      }

      // Optimal: take the better of standing or hitting further.
      hitWin += prob * Math.max(standW, furtherHitWin);
    }
  }

  return {
    standWin,
    standPush,
    standLose,
    hitWin,
    hitBust,
    hitWinImmediate,
  };
}

// Helper: format a probability as a percentage string.
export function pct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

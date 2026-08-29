// Shared types for the Blackjack game.
// These mirror the server-side edge function response shapes.

export interface PlayerHandView {
  cards: string[];
  bet: number;
  doubled: boolean;
  stood: boolean;
  busted: boolean;
  resolved: "none" | "win" | "lose" | "push" | "blackjack";
  payout: number;
  total: number;
  soft: boolean;
  blackjack: boolean;
}

export interface RoundView {
  bet: number;
  player_hands: PlayerHandView[];
  dealer_cards: string[];
  dealer_total: number;
  active_hand_index: number;
  phase: "insurance" | "player_turn" | "dealer_turn" | "resolved";
  insurance_bet: number;
  dealer_hole_hidden: boolean;
}

export interface GameState {
  round: RoundView | null;
  session_id: string | null;
  stake: number;
  shoe_remaining: number;
  initial_shoe_size: number;
  round_count: number;
  balance: number | null;
  bonus_available: boolean;
  hours_until_bonus: number;
}

export interface GameResponse extends GameState {
  error?: string;
}

export const VALID_STAKES = [10, 20, 100, 1000] as const;
export type Stake = (typeof VALID_STAKES)[number];
export const STARTING_BALANCE = 10000;

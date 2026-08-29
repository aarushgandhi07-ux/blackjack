/*
# Add active round state to game_sessions

1. Modified Tables
- `game_sessions`: add `active_round` (jsonb, nullable) column.
  When a round is in progress, this stores the full game state (player hands,
  dealer cards, bet, phase, etc.) so the edge function can resume between
  client requests. When the round resolves, the column is set to NULL and a
  row is inserted into `rounds`.
- `game_sessions`: add `round_count` (integer, default 0) to track how many
  rounds have been played with this shoe.

2. Security
- No policy changes needed — the column is covered by the existing
  SELECT-only policy. All writes are done server-side via the service role.

3. Notes
- The active_round jsonb structure:
  { bet, player_hands: [{cards, doubled, stood, busted}], dealer_cards,
    dealer_hidden, active_hand_index, phase, insurance_bet }
- phase values: "insurance" | "player_turn" | "dealer_turn" | "resolved"
*/

ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS active_round jsonb;

ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS round_count integer NOT NULL DEFAULT 0;

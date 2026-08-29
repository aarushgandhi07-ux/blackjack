/*
# Add daily bonus tracking column to profiles

1. Modified Tables
- `profiles`: add `last_daily_bonus` (timestamptz, nullable) column.
  Stores the timestamp of the last daily bonus claim. When null, the user
  has never claimed. The edge function checks if 24+ hours have passed
  since this timestamp before granting another ₹1000 bonus.

2. Security
- No policy changes needed — the column is covered by existing RLS.
  All writes are done server-side via the service role key.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_daily_bonus timestamptz;

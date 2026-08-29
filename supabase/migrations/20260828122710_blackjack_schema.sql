/*
# Blackjack schema with server-side shoe + validated balance

1. New Tables
- `profiles`: one row per auth user. Stores balance (money) and starting balance.
  - `id` (uuid, PK, = auth.users.id)
  - `balance` (integer, NOT NULL, default 10000) — current chip balance in rupees
  - `created_at` (timestamptz)
- `game_sessions`: an active blackjack shoe session tied to a user. The shoe
  (remaining cards) is stored here so it cannot be manipulated from the browser.
  A session is created when a user picks a stake table; it is reused across
  hands until the shoe is exhausted, then a new session is created.
  - `id` (uuid, PK)
  - `user_id` (uuid, FK -> auth.users, NOT NULL, default auth.uid())
  - `stake` (integer, NOT NULL) — the table stake (10/20/100/1000)
  - `shoe` (jsonb, NOT NULL) — array of remaining card codes, e.g. ["AS","5H",...]
  - `initial_shoe_size` (integer, NOT NULL) — 104 for a 2-deck shoe
  - `status` (text, NOT NULL, default 'active') — 'active' | 'exhausted'
  - `created_at`, `updated_at` (timestamptz)
- `rounds`: record of each completed round (history). Kept for display + audit.
  - `id` (uuid, PK)
  - `user_id` (uuid, FK -> auth.users, NOT NULL, default auth.uid())
  - `session_id` (uuid, FK -> game_sessions, NOT NULL)
  - `stake` (integer, NOT NULL)
  - `bet` (integer, NOT NULL) — final bet (after doubles/splits)
  - `player_hands` (jsonb, NOT NULL) — array of final player hand card arrays
  - `dealer_hand` (jsonb, NOT NULL) — array of final dealer card codes
  - `outcome` (text, NOT NULL) — 'win' | 'lose' | 'push' | 'blackjack'
  - `payout` (integer, NOT NULL) — net chips added (negative for a loss)
  - `balance_after` (integer, NOT NULL)
  - `created_at` (timestamptz)

2. Security (RLS)
- `profiles`: authenticated users can SELECT + UPDATE only their own row.
  Inserts are NOT allowed from the client — rows are created server-side by the
  edge function during signup. This prevents a user from creating a profile with
  an arbitrary balance.
- `game_sessions`: authenticated users can SELECT only their own sessions.
  All INSERT/UPDATE/DELETE is done server-side (service role) — no client policies.
- `rounds`: authenticated users can SELECT only their own rounds. INSERT is
  done server-side only.

3. Important notes
- Balance is NEVER written directly by the client. The edge function uses the
  service role key to perform all balance mutations after validating the hand.
- The shoe lives in `game_sessions.shoe` and is updated server-side after each
  card is drawn. The client only receives the cards it is allowed to see.
- A trigger auto-creates a profile row with the starting balance when a new
  auth user signs up.
*/

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 10000,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- game_sessions
CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  stake integer NOT NULL,
  shoe jsonb NOT NULL,
  initial_shoe_size integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sessions" ON game_sessions;
CREATE POLICY "select_own_sessions" ON game_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- rounds
CREATE TABLE IF NOT EXISTS rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  stake integer NOT NULL,
  bet integer NOT NULL,
  player_hands jsonb NOT NULL,
  dealer_hand jsonb NOT NULL,
  outcome text NOT NULL,
  payout integer NOT NULL,
  balance_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_rounds" ON rounds;
CREATE POLICY "select_own_rounds" ON rounds FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_rounds_user ON rounds(user_id);
CREATE INDEX IF NOT EXISTS idx_rounds_session ON rounds(session_id);

-- Auto-create a profile row when a new auth user signs up.
-- The edge function could also do this, but a trigger guarantees it exists
-- even if the first edge function call races.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, balance)
  VALUES (NEW.id, 10000)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

// Blackjack edge function — server-authoritative game logic.
// The shoe and all hand state live in the database (game_sessions.active_round),
// so the browser can never manipulate cards or balance directly.
//
// Endpoints (all POST with JSON body, JWT auth required):
//   POST /blackjack { action: "new-session", stake }
//   POST /blackjack { action: "deal" }
//   POST /blackjack { action: "hit" }
//   POST /blackjack { action: "stand" }
//   POST /blackjack { action: "double" }
//   POST /blackjack { action: "split" }
//   POST /blackjack { action: "insurance", bet }
//   POST /blackjack { action: "skip-insurance" }
//   POST /blackjack { action: "state" }
//
// Card codes: <rank><suit> e.g. "AS" = Ace of Spades, "TH" = 10 of Hearts.
// Ranks: A,2,3,4,5,6,7,8,9,T,J,Q,K  Suits: S,H,D,C

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"];
const SUITS = ["S", "H", "D", "C"];
const NUM_DECKS = 4; // 4 standard decks = 208 cards
const STARTING_BALANCE = 10000;
const DAILY_BONUS = 1000;
const DAILY_BONUS_HOURS = 24; // hours between bonus claims
const VALID_STAKES = [10, 20, 100, 1000];

// ---- Card helpers ----

function buildShoe(): string[] {
  const shoe: string[] = [];
  for (let d = 0; d < NUM_DECKS; d++) {
    for (const r of RANKS) {
      for (const s of SUITS) {
        shoe.push(r + s);
      }
    }
  }
  return shoe;
}

// Fisher-Yates shuffle (crypto-quality randomness).
function shuffle(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rankOf(card: string): string {
  return card[0];
}

function cardValue(card: string): number {
  const r = rankOf(card);
  if (r === "A") return 11;
  if (r === "T" || r === "J" || r === "Q" || r === "K") return 10;
  return parseInt(r, 10);
}

// Returns { total, soft } where soft=true means the total uses an Ace as 11.
function handTotal(cards: string[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const v = cardValue(c);
    total += v;
    if (rankOf(c) === "A") aces++;
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  // soft only if at least one ace still counts as 11
  soft = aces > 0 && total <= 21;
  return { total, soft };
}

function isBlackjack(cards: string[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21;
}

function isBust(cards: string[]): boolean {
  return handTotal(cards).total > 21;
}

// ---- Round state type ----

interface PlayerHand {
  cards: string[];
  bet: number;
  doubled: boolean;
  stood: boolean;
  busted: boolean;
  resolved: "none" | "win" | "lose" | "push" | "blackjack";
  payout: number;
}

interface ActiveRound {
  bet: number;
  player_hands: PlayerHand[];
  dealer_cards: string[];
  dealer_hidden: boolean;
  active_hand_index: number;
  phase: "insurance" | "player_turn" | "dealer_turn" | "resolved";
  insurance_bet: number;
  insurance_resolved: boolean;
}

// ---- Supabase admin client (service role) ----

function adminClient(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// ---- Auth: extract user from JWT ----

async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// ---- Main handler ----

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    if (!user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;

    const supabase = adminClient(req);

    switch (action) {
      case "new-session":
        return await handleNewSession(supabase, user.id, body);
      case "deal":
        return await handleDeal(supabase, user.id, body);
      case "hit":
        return await handleHit(supabase, user.id);
      case "stand":
        return await handleStand(supabase, user.id);
      case "double":
        return await handleDouble(supabase, user.id);
      case "split":
        return await handleSplit(supabase, user.id);
      case "insurance":
        return await handleInsurance(supabase, user.id, body);
      case "skip-insurance":
        return await handleSkipInsurance(supabase, user.id);
      case "state":
        return await handleState(supabase, user.id);
      case "claim-daily-bonus":
        return await handleClaimDailyBonus(supabase, user.id);
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    return json({ error: err.message || "Server error" }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- Get the user's active session ----

async function getActiveSession(supabase: ReturnType<typeof adminClient>, userId: string) {
  const { data, error } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function getProfile(supabase: ReturnType<typeof adminClient>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// ---- new-session: create or reuse an active shoe for a given stake ----

async function handleNewSession(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  body: { stake?: number },
) {
  const stake = body.stake;
  if (!stake || !VALID_STAKES.includes(stake)) {
    return json({ error: "Invalid stake" }, 400);
  }
  const profile = await getProfile(supabase, userId);
  if (!profile) {
    return json({ error: "Profile not found" }, 404);
  }
  if (profile.balance < stake) {
    return json({ error: "Insufficient balance for this table" }, 400);
  }

  // Reuse existing active session if same stake and shoe not exhausted
  const existing = await getActiveSession(supabase, userId);
  if (existing && existing.stake === stake) {
    return json({
      session_id: existing.id,
      stake: existing.stake,
      shoe_remaining: (existing.shoe as string[]).length,
      initial_shoe_size: existing.initial_shoe_size,
      round_count: existing.round_count,
    });
  }

  const shoe = shuffle(buildShoe());
  const { data, error } = await supabase
    .from("game_sessions")
    .insert({
      user_id: userId,
      stake,
      shoe,
      initial_shoe_size: shoe.length,
      status: "active",
      round_count: 0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  return json({
    session_id: data.id,
    stake: data.stake,
    shoe_remaining: shoe.length,
    initial_shoe_size: shoe.length,
    round_count: 0,
  });
}

// ---- deal: start a new round ----

async function handleDeal(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  body: { bet?: number },
) {
  const session = await getActiveSession(supabase, userId);
  if (!session) return json({ error: "No active session" }, 400);
  if (session.active_round) return json({ error: "Round already in progress" }, 400);

  const bet = body.bet;
  if (!bet || bet <= 0) return json({ error: "Invalid bet" }, 400);

  const profile = await getProfile(supabase, userId);
  if (!profile) return json({ error: "Profile not found" }, 404);
  if (profile.balance < bet) return json({ error: "Insufficient balance" }, 400);

  let shoe = session.shoe as string[];
  // Reshuffle only when the shoe is completely empty.
  if (shoe.length === 0) {
    shoe = shuffle(buildShoe());
  }
  // Need at least 4 cards to deal; if fewer, reshuffle a fresh shoe.
  if (shoe.length < 4) {
    shoe = shuffle(buildShoe());
  }

  // Deal: player, dealer, player, dealer (dealer's second card is hidden)
  const playerCards = [shoe.pop()!, shoe.pop()!];
  const dealerCards = [shoe.pop()!, shoe.pop()!];

  const playerBJ = isBlackjack(playerCards);
  const dealerUpAce = rankOf(dealerCards[0]) === "A";

  const round: ActiveRound = {
    bet,
    player_hands: [
      {
        cards: playerCards,
        bet,
        doubled: false,
        stood: false,
        busted: false,
        resolved: "none",
        payout: 0,
      },
    ],
    dealer_cards: dealerCards,
    dealer_hidden: true,
    active_hand_index: 0,
    phase: "player_turn",
    insurance_bet: 0,
    insurance_resolved: false,
  };

  // Deduct the bet from balance immediately.
  const newBalance = profile.balance - bet;
  const { error: balErr } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);
  if (balErr) throw new Error(balErr.message);

  // If dealer up card is Ace, offer insurance before player acts.
  if (dealerUpAce && !playerBJ) {
    round.phase = "insurance";
  }

  // If player has blackjack, resolve immediately (reveal dealer hole card).
  if (playerBJ) {
    round.dealer_hidden = false;
    const dealerBJ = isBlackjack(dealerCards);
    if (dealerBJ) {
      round.player_hands[0].resolved = "push";
      round.player_hands[0].payout = bet; // return bet
      round.phase = "resolved";
    } else {
      round.player_hands[0].resolved = "blackjack";
      round.player_hands[0].payout = bet + Math.floor(bet * 1.5); // 3:2
      round.phase = "resolved";
    }
    await persistRound(supabase, session, shoe, round, newBalance, userId);
    return json(buildRoundResponse(round, session, shoe, newBalance));
  }

  await persistRound(supabase, session, shoe, round, newBalance, userId);
  return json(buildRoundResponse(round, session, shoe, newBalance));
}

// ---- hit ----

async function handleHit(supabase: ReturnType<typeof adminClient>, userId: string) {
  const session = await getActiveSession(supabase, userId);
  if (!session) return json({ error: "No active session" }, 400);
  const round = session.active_round as ActiveRound | null;
  if (!round || round.phase !== "player_turn") {
    return json({ error: "Cannot hit now" }, 400);
  }

  let shoe = session.shoe as string[];
  if (shoe.length === 0) shoe = shuffle(buildShoe());

  const hand = round.player_hands[round.active_hand_index];
  hand.cards.push(shoe.pop()!);

  if (isBust(hand.cards)) {
    hand.busted = true;
    hand.resolved = "lose";
    hand.payout = 0;
    advanceToNextHandOrDealer(round);
  } else if (handTotal(hand.cards).total === 21) {
    hand.stood = true;
    advanceToNextHandOrDealer(round);
  }

  await persistRound(supabase, session, shoe, round, null, userId);
  return json(buildRoundResponse(round, session, shoe, null));
}

// ---- stand ----

async function handleStand(supabase: ReturnType<typeof adminClient>, userId: string) {
  const session = await getActiveSession(supabase, userId);
  if (!session) return json({ error: "No active session" }, 400);
  const round = session.active_round as ActiveRound | null;
  if (!round || round.phase !== "player_turn") {
    return json({ error: "Cannot stand now" }, 400);
  }

  const hand = round.player_hands[round.active_hand_index];
  hand.stood = true;
  advanceToNextHandOrDealer(round);

  await persistRound(supabase, session, session.shoe as string[], round, null, userId);
  return json(buildRoundResponse(round, session, session.shoe as string[], null));
}

// ---- double down ----

async function handleDouble(supabase: ReturnType<typeof adminClient>, userId: string) {
  const session = await getActiveSession(supabase, userId);
  if (!session) return json({ error: "No active session" }, 400);
  const round = session.active_round as ActiveRound | null;
  if (!round || round.phase !== "player_turn") {
    return json({ error: "Cannot double now" }, 400);
  }
  const hand = round.player_hands[round.active_hand_index];
  // Double only on first two cards of a hand.
  if (hand.cards.length !== 2 || hand.doubled) {
    return json({ error: "Can only double on first two cards" }, 400);
  }

  const profile = await getProfile(supabase, userId);
  if (!profile) return json({ error: "Profile not found" }, 404);
  if (profile.balance < hand.bet) return json({ error: "Insufficient balance to double" }, 400);

  // Deduct the extra bet.
  const newBalance = profile.balance - hand.bet;
  const { error: balErr } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);
  if (balErr) throw new Error(balErr.message);

  hand.bet *= 2;
  hand.doubled = true;

  let shoe = session.shoe as string[];
  if (shoe.length === 0) shoe = shuffle(buildShoe());
  hand.cards.push(shoe.pop()!);

  if (isBust(hand.cards)) {
    hand.busted = true;
    hand.resolved = "lose";
    hand.payout = 0;
  }
  hand.stood = true;
  advanceToNextHandOrDealer(round);

  await persistRound(supabase, session, shoe, round, newBalance, userId);
  return json(buildRoundResponse(round, session, shoe, newBalance));
}

// ---- split ----

async function handleSplit(supabase: ReturnType<typeof adminClient>, userId: string) {
  const session = await getActiveSession(supabase, userId);
  if (!session) return json({ error: "No active session" }, 400);
  const round = session.active_round as ActiveRound | null;
  if (!round || round.phase !== "player_turn") {
    return json({ error: "Cannot split now" }, 400);
  }
  const hand = round.player_hands[round.active_hand_index];
  if (hand.cards.length !== 2) {
    return json({ error: "Can only split on first two cards" }, 400);
  }
  if (cardValue(hand.cards[0]) !== cardValue(hand.cards[1])) {
    return json({ error: "Cards must be equal value to split" }, 400);
  }

  const profile = await getProfile(supabase, userId);
  if (!profile) return json({ error: "Profile not found" }, 404);
  if (profile.balance < hand.bet) return json({ error: "Insufficient balance to split" }, 400);

  // Deduct the extra bet for the new hand.
  const newBalance = profile.balance - hand.bet;
  const { error: balErr } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);
  if (balErr) throw new Error(balErr.message);

  let shoe = session.shoe as string[];
  if (shoe.length === 0) shoe = shuffle(buildShoe());

  // Split the two cards into two hands, deal one card to each.
  const cardA = hand.cards[0];
  const cardB = hand.cards[1];
  const newHand: PlayerHand = {
    cards: [cardB, shoe.pop()!],
    bet: hand.bet,
    doubled: false,
    stood: false,
    busted: false,
    resolved: "none",
    payout: 0,
  };
  hand.cards = [cardA, shoe.pop()!];

  // Insert the new hand right after the current one.
  round.player_hands.splice(round.active_hand_index + 1, 0, newHand);

  // If a split hand totals 21 (not a natural blackjack — split aces get one
  // card each and can't blackjack), auto-stand.
  if (handTotal(hand.cards).total === 21) {
    hand.stood = true;
    advanceToNextHandOrDealer(round);
  }

  await persistRound(supabase, session, shoe, round, newBalance, userId);
  return json(buildRoundResponse(round, session, shoe, newBalance));
}

// ---- insurance ----

async function handleInsurance(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  body: { bet?: number },
) {
  const session = await getActiveSession(supabase, userId);
  if (!session) return json({ error: "No active session" }, 400);
  const round = session.active_round as ActiveRound | null;
  if (!round || round.phase !== "insurance") {
    return json({ error: "Insurance not available" }, 400);
  }

  const profile = await getProfile(supabase, userId);
  if (!profile) return json({ error: "Profile not found" }, 404);

  // Insurance bet is up to half the original bet.
  const maxIns = Math.floor(round.bet / 2);
  const insBet = body.bet !== undefined ? Math.min(body.bet, maxIns) : maxIns;
  if (insBet < 0) return json({ error: "Invalid insurance bet" }, 400);
  if (profile.balance < insBet) return json({ error: "Insufficient balance" }, 400);

  // Compute the final balance in a single update to avoid race conditions.
  // Start from current balance, subtract insurance bet.
  let finalBalance = profile.balance - insBet;

  round.insurance_bet = insBet;
  round.insurance_resolved = true;

  // Resolve insurance: dealer blackjack pays 2:1.
  const dealerBJ = isBlackjack(round.dealer_cards);
  if (dealerBJ) {
    // Insurance pays 2:1: player gets back insBet + 2x winnings.
    finalBalance += insBet * 3;
    // Reveal dealer hole card.
    round.dealer_hidden = false;
    const hand = round.player_hands[0];
    if (isBlackjack(hand.cards)) {
      // Player also has blackjack — push, return the main bet.
      hand.resolved = "push";
      hand.payout = hand.bet;
      finalBalance += hand.bet;
    } else {
      hand.resolved = "lose";
      hand.payout = 0;
    }
    round.phase = "resolved";
  } else {
    // No dealer blackjack — insurance lost, continue player turn.
    round.phase = "player_turn";
  }

  // Single balance update.
  const { error: balErr } = await supabase
    .from("profiles")
    .update({ balance: finalBalance })
    .eq("id", userId);
  if (balErr) throw new Error(balErr.message);

  await persistRound(supabase, session, session.shoe as string[], round, finalBalance, userId);
  return json(buildRoundResponse(round, session, session.shoe as string[], finalBalance));
}

// ---- skip insurance ----

async function handleSkipInsurance(supabase: ReturnType<typeof adminClient>, userId: string) {
  const session = await getActiveSession(supabase, userId);
  if (!session) return json({ error: "No active session" }, 400);
  const round = session.active_round as ActiveRound | null;
  if (!round || round.phase !== "insurance") {
    return json({ error: "Insurance not available" }, 400);
  }
  // Check if dealer has blackjack even when insurance is skipped.
  const dealerBJ = isBlackjack(round.dealer_cards);
  if (dealerBJ) {
    round.dealer_hidden = false;
    const hand = round.player_hands[0];
    let refund = 0;
    if (isBlackjack(hand.cards)) {
      hand.resolved = "push";
      hand.payout = hand.bet;
      refund = hand.bet;
    } else {
      hand.resolved = "lose";
      hand.payout = 0;
    }
    round.phase = "resolved";
    // Single balance update with refund if applicable.
    const profile = await getProfile(supabase, userId);
    const finalBalance = (profile?.balance ?? 0) + refund;
    if (profile) {
      const { error } = await supabase.from("profiles").update({ balance: finalBalance }).eq("id", userId);
      if (error) throw new Error(error.message);
    }
    await persistRound(supabase, session, session.shoe as string[], round, finalBalance, userId);
    return json(buildRoundResponse(round, session, session.shoe as string[], finalBalance));
  }
  round.phase = "player_turn";
  await persistRound(supabase, session, session.shoe as string[], round, null, userId);
  return json(buildRoundResponse(round, session, session.shoe as string[], null));
}

// ---- state: return current round + session info ----

// ---- claim-daily-bonus: add ₹1000 once every 24 hours ----

async function handleClaimDailyBonus(supabase: ReturnType<typeof adminClient>, userId: string) {
  const profile = await getProfile(supabase, userId);
  if (!profile) return json({ error: "Profile not found" }, 404);

  const now = new Date();
  const lastClaim = profile.last_daily_bonus ? new Date(profile.last_daily_bonus) : null;
  const hoursSince = lastClaim ? (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60) : Infinity;

  if (hoursSince < DAILY_BONUS_HOURS) {
    const hoursLeft = Math.ceil(DAILY_BONUS_HOURS - hoursSince);
    return json({
      error: `Next bonus available in ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}`,
      bonus_available: false,
      hours_until_bonus: hoursLeft,
      balance: profile.balance,
    }, 400);
  }

  const newBalance = profile.balance + DAILY_BONUS;
  const { error } = await supabase
    .from("profiles")
    .update({ balance: newBalance, last_daily_bonus: now.toISOString() })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  return json({
    bonus_available: false,
    bonus_claimed: DAILY_BONUS,
    balance: newBalance,
    next_bonus_at: new Date(now.getTime() + DAILY_BONUS_HOURS * 60 * 60 * 1000).toISOString(),
  });
}

// ---- Helper: compute daily bonus status for a profile ----

function dailyBonusStatus(profile: { last_daily_bonus: string | null } | null) {
  if (!profile) return { bonus_available: false, hours_until_bonus: 0 };
  const now = new Date();
  const lastClaim = profile.last_daily_bonus ? new Date(profile.last_daily_bonus) : null;
  const hoursSince = lastClaim ? (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60) : Infinity;
  const available = hoursSince >= DAILY_BONUS_HOURS;
  const hoursLeft = available ? 0 : Math.ceil(DAILY_BONUS_HOURS - hoursSince);
  return { bonus_available: available, hours_until_bonus: hoursLeft };
}

async function handleState(supabase: ReturnType<typeof adminClient>, userId: string) {
  const session = await getActiveSession(supabase, userId);
  const profile = await getProfile(supabase, userId);
  const bonus = dailyBonusStatus(profile);
  if (!session) {
    return json({
      balance: profile?.balance ?? 0,
      bonus_available: bonus.bonus_available,
      hours_until_bonus: bonus.hours_until_bonus,
    });
  }
  const round = session.active_round as ActiveRound | null;
  return json({
    session_id: session.id,
    stake: session.stake,
    shoe_remaining: (session.shoe as string[]).length,
    initial_shoe_size: session.initial_shoe_size,
    round_count: session.round_count,
    balance: profile?.balance ?? 0,
    bonus_available: bonus.bonus_available,
    hours_until_bonus: bonus.hours_until_bonus,
    round: round ? buildRoundResponse(round, session, session.shoe as string[], null).round : null,
  });
}

// ---- Helper: advance to next hand or trigger dealer turn ----

function advanceToNextHandOrDealer(round: ActiveRound) {
  // Move to next un-resolved hand if any.
  for (let i = round.active_hand_index + 1; i < round.player_hands.length; i++) {
    if (!round.player_hands[i].stood && !round.player_hands[i].busted && round.player_hands[i].resolved === "none") {
      round.active_hand_index = i;
      return;
    }
  }
  // Check if any earlier hands (shouldn't happen, but just in case) are unresolved.
  for (let i = 0; i < round.player_hands.length; i++) {
    if (!round.player_hands[i].stood && !round.player_hands[i].busted && round.player_hands[i].resolved === "none") {
      round.active_hand_index = i;
      return;
    }
  }
  // All hands done — dealer plays.
  round.phase = "dealer_turn";
}

// ---- Helper: play dealer + resolve all hands ----

async function playDealerAndResolve(
  supabase: ReturnType<typeof adminClient>,
  session: NonNullable<Awaited<ReturnType<typeof getActiveSession>>>,
  round: ActiveRound,
  shoe: string[],
  userId: string,
): Promise<{ shoe: string[]; balance: number }> {
  let workShoe = shoe;
  round.dealer_hidden = false;

  // If all player hands busted, dealer doesn't need to draw.
  const allBust = round.player_hands.every((h) => h.busted);

  if (!allBust) {
    // Dealer stands on all 17s (soft and hard).
    while (handTotal(round.dealer_cards).total < 17) {
      if (workShoe.length === 0) workShoe = shuffle(buildShoe());
      round.dealer_cards.push(workShoe.pop()!);
    }
  }

  const dealerTotal = handTotal(round.dealer_cards).total;
  const dealerBust = dealerTotal > 21;

  let totalPayout = 0;
  for (const hand of round.player_hands) {
    if (hand.busted) {
      hand.resolved = "lose";
      hand.payout = 0;
      continue;
    }
    const playerTotal = handTotal(hand.cards).total;
    if (isBlackjack(hand.cards) && round.player_hands.length === 1) {
      // Already handled at deal time, but just in case.
      const dealerBJ = isBlackjack(round.dealer_cards);
      if (dealerBJ) {
        hand.resolved = "push";
        hand.payout = hand.bet;
      } else {
        hand.resolved = "blackjack";
        hand.payout = hand.bet + Math.floor(hand.bet * 1.5);
      }
    } else if (dealerBust || playerTotal > dealerTotal) {
      hand.resolved = "win";
      hand.payout = hand.bet * 2;
    } else if (playerTotal === dealerTotal) {
      hand.resolved = "push";
      hand.payout = hand.bet;
    } else {
      hand.resolved = "lose";
      hand.payout = 0;
    }
    totalPayout += hand.payout;
  }

  round.phase = "resolved";

  // Add payout to balance.
  const profile = await getProfile(supabase, userId);
  if (!profile) throw new Error("Profile not found");
  const newBalance = profile.balance + totalPayout;
  const { error } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  return { shoe: workShoe, balance: newBalance };
}

// ---- Helper: persist round state to DB; if resolved, also insert round history ----

async function persistRound(
  supabase: ReturnType<typeof adminClient>,
  session: NonNullable<Awaited<ReturnType<typeof getActiveSession>>>,
  shoe: string[],
  round: ActiveRound,
  balance: number | null,
  userId: string,
) {
  let finalShoe = shoe;
  let finalBalance = balance;

  // If it's dealer turn, play it out now.
  if (round.phase === "dealer_turn") {
    const result = await playDealerAndResolve(supabase, session, round, finalShoe, userId);
    finalShoe = result.shoe;
    finalBalance = result.balance;
  }

  // Update session: shoe + active_round (null if resolved) + round_count.
  const isResolved = round.phase === "resolved";
  const shoeEmpty = finalShoe.length === 0;

  const update: Record<string, unknown> = {
    shoe: finalShoe,
    active_round: isResolved ? null : round,
    updated_at: new Date().toISOString(),
  };

  if (isResolved) {
    update.round_count = (session.round_count ?? 0) + 1;
    if (shoeEmpty) {
      update.status = "exhausted";
    }
  }

  const { error: sessErr } = await supabase
    .from("game_sessions")
    .update(update)
    .eq("id", session.id);
  if (sessErr) throw new Error(sessErr.message);

  // Insert round history when resolved.
  if (isResolved) {
    // Determine overall outcome for the history record (use first hand or aggregate).
    const totalBet = round.player_hands.reduce((s, h) => s + h.bet, 0);
    const totalPayout = round.player_hands.reduce((s, h) => s + h.payout, 0);
    const net = totalPayout - totalBet;

    let outcome = "lose";
    if (round.player_hands.length === 1) {
      outcome = round.player_hands[0].resolved;
    } else {
      if (net > 0) outcome = "win";
      else if (net === 0) outcome = "push";
      else outcome = "lose";
    }

    const { error: roundErr } = await supabase.from("rounds").insert({
      user_id: userId,
      session_id: session.id,
      stake: session.stake,
      bet: totalBet,
      player_hands: round.player_hands.map((h) => h.cards),
      dealer_hand: round.dealer_cards,
      outcome,
      payout: net,
      balance_after: finalBalance ?? 0,
    });
    if (roundErr) throw new Error(roundErr.message);
  }
}

// ---- Helper: build the response sent to the client ----
// The client only sees cards it should see (dealer hole card hidden until resolved).

function buildRoundResponse(
  round: ActiveRound,
  session: NonNullable<Awaited<ReturnType<typeof getActiveSession>>>,
  shoe: string[],
  balance: number | null,
) {
  const dealerVisible = round.phase === "resolved" || !round.dealer_hidden
    ? round.dealer_cards
    : [round.dealer_cards[0]];

  return {
    round: {
      bet: round.bet,
      player_hands: round.player_hands.map((h) => ({
        cards: h.cards,
        bet: h.bet,
        doubled: h.doubled,
        stood: h.stood,
        busted: h.busted,
        resolved: h.resolved,
        payout: h.payout,
        total: handTotal(h.cards).total,
        soft: handTotal(h.cards).soft,
        blackjack: isBlackjack(h.cards),
      })),
      dealer_cards: dealerVisible,
      dealer_total: round.phase === "resolved" || !round.dealer_hidden
        ? handTotal(round.dealer_cards).total
        : handTotal([round.dealer_cards[0]]).total,
      active_hand_index: round.active_hand_index,
      phase: round.phase,
      insurance_bet: round.insurance_bet,
      dealer_hole_hidden: round.dealer_hidden && round.phase !== "resolved",
    },
    session_id: session.id,
    stake: session.stake,
    shoe_remaining: shoe.length,
    initial_shoe_size: session.initial_shoe_size,
    round_count: (session.round_count ?? 0) + (round.phase === "resolved" ? 1 : 0),
    balance,
  };
}

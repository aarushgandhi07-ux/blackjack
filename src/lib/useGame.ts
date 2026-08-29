import { useCallback, useEffect, useRef, useState } from "react";
import { gameApi } from "./gameApi";
import type { GameState, GameResponse } from "./types";
import { STARTING_BALANCE } from "./types";

const initialState: GameState = {
  round: null,
  session_id: null,
  stake: 0,
  shoe_remaining: 0,
  initial_shoe_size: 0,
  round_count: 0,
  balance: null,
  bonus_available: false,
  hours_until_bonus: 0,
};

export function useGame() {
  const [state, setState] = useState<GameState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track all cards the client has seen dealt, for probability calculation.
  // Reset whenever a new session starts.
  const dealtCardsRef = useRef<string[]>([]);

  const applyResponse = useCallback((resp: GameResponse) => {
    setState({
      round: resp.round ?? null,
      session_id: resp.session_id ?? null,
      stake: resp.stake ?? 0,
      shoe_remaining: resp.shoe_remaining ?? 0,
      initial_shoe_size: resp.initial_shoe_size ?? 0,
      round_count: resp.round_count ?? 0,
      balance: resp.balance ?? null,
      bonus_available: resp.bonus_available ?? false,
      hours_until_bonus: resp.hours_until_bonus ?? 0,
    });
    // Track dealt cards from the response for probability calculation.
    if (resp.round) {
      const cards: string[] = [];
      for (const h of resp.round.player_hands) cards.push(...h.cards);
      cards.push(...resp.round.dealer_cards);
      dealtCardsRef.current = cards;
    }
  }, []);

  const newSession = useCallback(async (stake: number) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await gameApi.newSession(stake);
      dealtCardsRef.current = [];
      setState((prev) => ({
        ...prev,
        session_id: resp.session_id ?? null,
        stake: resp.stake ?? stake,
        shoe_remaining: resp.shoe_remaining ?? 0,
        initial_shoe_size: resp.initial_shoe_size ?? 0,
        round_count: resp.round_count ?? 0,
        round: null,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start session");
    } finally {
      setLoading(false);
    }
  }, []);

  const deal = useCallback(async (bet: number) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await gameApi.deal(bet);
      applyResponse(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deal failed");
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  const hit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await gameApi.hit();
      applyResponse(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hit failed");
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  const stand = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await gameApi.stand();
      applyResponse(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stand failed");
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  const double = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await gameApi.double();
      applyResponse(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Double failed");
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  const split = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await gameApi.split();
      applyResponse(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Split failed");
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  const insurance = useCallback(async (bet: number) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await gameApi.insurance(bet);
      applyResponse(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Insurance failed");
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  const skipInsurance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await gameApi.skipInsurance();
      applyResponse(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  // Fetch current state on mount (resume an in-progress round).
  const refreshState = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await gameApi.state();
      applyResponse(resp);
    } catch {
      // No active session yet — that's fine.
      setState(initialState);
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  const claimDailyBonus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await gameApi.claimDailyBonus();
      setState((prev) => ({
        ...prev,
        balance: resp.balance ?? prev.balance,
        bonus_available: false,
        hours_until_bonus: 24,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to claim bonus");
      // Refresh state to get accurate countdown
      await refreshState();
    } finally {
      setLoading(false);
    }
  }, [refreshState]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  return {
    state,
    loading,
    error,
    dealtCards: dealtCardsRef.current,
    newSession,
    deal,
    hit,
    stand,
    double,
    split,
    insurance,
    skipInsurance,
    claimDailyBonus,
    refreshState,
    clearError: () => setError(null),
    STARTING_BALANCE,
  };
}

// Game API client — calls the server-side blackjack edge function.
// All game logic (shoe management, dealing, resolution, balance updates) runs
// on the server. The client only sends action requests and renders responses.

import { supabase } from "./supabase";
import type { GameResponse } from "./types";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blackjack`;

async function callEdge(action: string, extra: Record<string, unknown> = {}): Promise<GameResponse> {
  const { data: session } = await supabase.auth.getSession();
  const accessToken = session?.session?.access_token;
  if (!accessToken) throw new Error("Not authenticated");

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({ action, ...extra }),
  });

  const data = await response.json().catch(() => ({ error: "Invalid response" }));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  if (data.error) throw new Error(data.error);
  return data as GameResponse;
}

export const gameApi = {
  newSession: (stake: number) => callEdge("new-session", { stake }),
  deal: (bet: number) => callEdge("deal", { bet }),
  hit: () => callEdge("hit"),
  stand: () => callEdge("stand"),
  double: () => callEdge("double"),
  split: () => callEdge("split"),
  insurance: (bet: number) => callEdge("insurance", { bet }),
  skipInsurance: () => callEdge("skip-insurance"),
  state: () => callEdge("state"),
  claimDailyBonus: () => callEdge("claim-daily-bonus"),
};

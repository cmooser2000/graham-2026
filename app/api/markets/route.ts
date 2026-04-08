import { NextResponse } from "next/server";
import { fetchPolymarket, fetchKalshi, CANDIDATE } from "@/lib/markets/fetchers";

export const revalidate = 60;

export async function GET() {
  const [polymarket, kalshi] = await Promise.all([
    fetchPolymarket(),
    fetchKalshi(),
  ]);

  // Simple average odds
  const odds: number[] = [];
  if (polymarket.platner) {
    odds.push(polymarket.platner.odds);
  }
  if (kalshi.platner) {
    odds.push(kalshi.platner.odds_normalized ?? kalshi.platner.odds);
  }

  const averageOdds = odds.length > 0
    ? Math.round((odds.reduce((a, b) => a + b, 0) / odds.length) * 10) / 10
    : null;

  // Liquidity-weighted average
  const polyVol = polymarket.total_liquidity_raw ?? polymarket.total_volume_raw ?? 0;
  const kalshiVol = kalshi.total_volume_raw ?? 0;
  const totalVol = polyVol + kalshiVol;

  let weightedAverageOdds: number | null = null;
  if (totalVol > 0 && polymarket.platner && kalshi.platner) {
    const polyOdds = polymarket.platner.odds;
    const kalshiOdds = kalshi.platner.odds_normalized ?? kalshi.platner.odds;
    weightedAverageOdds = Math.round(
      ((polyOdds * polyVol + kalshiOdds * kalshiVol) / totalVol) * 10
    ) / 10;
  } else if (polymarket.platner && !kalshi.platner) {
    weightedAverageOdds = polymarket.platner.odds;
  } else if (kalshi.platner && !polymarket.platner) {
    weightedAverageOdds = kalshi.platner.odds_normalized ?? kalshi.platner.odds;
  }

  // Average top-2 probability
  const top2s: number[] = [];
  if (polymarket.platner?.top2_probability) {
    top2s.push(polymarket.platner.top2_probability);
  }
  if (kalshi.platner?.top2_probability) {
    top2s.push(kalshi.platner.top2_probability);
  }
  const averageTop2 = top2s.length > 0
    ? Math.round((top2s.reduce((a, b) => a + b, 0) / top2s.length) * 10) / 10
    : null;

  return NextResponse.json({
    candidate: CANDIDATE,
    average_odds: averageOdds,
    weighted_average_odds: weightedAverageOdds,
    average_top2: averageTop2,
    markets: {
      polymarket,
      kalshi,
    },
    fetched_at: new Date().toISOString(),
  });
}

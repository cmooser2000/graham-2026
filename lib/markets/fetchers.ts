import { Candidate, MarketData } from "./types";

const CANDIDATE = "Graham Platner";
// Maine Democratic Senate Primary 2026
// Source: https://polymarket.com/event/maine-democratic-senate-primary-winner
const POLYMARKET_EVENT_SLUG = "maine-democratic-senate-primary-winner";
// Source: https://kalshi.com/markets/kxsenatemed/med/kxsenatemed-26
const KALSHI_EVENT_TICKER = "KXSENATEMED-26";

function normalizeOdds(candidates: Candidate[]): { candidates: Candidate[]; oddsSum: number } {
  const sum = candidates.reduce((s, c) => s + c.odds, 0);

  if (sum <= 100) {
    return {
      candidates: candidates.map(c => ({ ...c, odds_normalized: c.odds })),
      oddsSum: sum,
    };
  }

  return {
    candidates: candidates.map(c => ({
      ...c,
      odds_normalized: Math.round((c.odds / sum) * 1000) / 10,
    })),
    oddsSum: sum,
  };
}

function calculateTop2Probabilities(candidates: Candidate[]): Candidate[] {
  const probs = candidates.map(c => ({
    name: c.name,
    p: (c.odds_normalized ?? c.odds) / 100,
  }));

  const top2Map = new Map<string, number>();

  for (const cand of probs) {
    let pTop2 = cand.p;

    for (const other of probs) {
      if (other.name === cand.name) continue;
      if (other.p >= 1) continue;
      pTop2 += other.p * (cand.p / (1 - other.p));
    }

    top2Map.set(cand.name, Math.min(Math.round(pTop2 * 1000) / 10, 100));
  }

  return candidates.map(c => ({
    ...c,
    top2_probability: top2Map.get(c.name),
  }));
}

export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

export async function fetchPolymarket(): Promise<MarketData> {
  try {
    const url = `https://gamma-api.polymarket.com/events?slug=${POLYMARKET_EVENT_SLUG}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return {
        source: "Polymarket",
        url: `https://polymarket.com/event/${POLYMARKET_EVENT_SLUG}`,
        candidates: [],
        platner: null,
        total_volume: "$0",
        fetched_at: new Date().toISOString(),
        error: "Event not found",
      };
    }

    const event = data[0];
    const markets = event.markets || [];

    const candidates: Candidate[] = [];
    let platner: Candidate | null = null;

    for (const market of markets) {
      if (!market.active) continue;

      const name = market.groupItemTitle || "";
      const pricesRaw = market.outcomePrices || "[]";

      let odds = 0;
      try {
        const pricesList =
          typeof pricesRaw === "string" ? JSON.parse(pricesRaw) : pricesRaw;
        odds = pricesList.length > 0 ? Math.round(parseFloat(pricesList[0]) * 1000) / 10 : 0;
      } catch {
        odds = 0;
      }

      const volume = market.volumeNum || 0;

      const candidate: Candidate = {
        name,
        odds,
        volume: formatVolume(volume),
        volume_raw: volume,
        change_1d: market.oneDayPriceChange || 0,
        change_1w: market.oneWeekPriceChange || 0,
      };

      candidates.push(candidate);

      if (name.toLowerCase().includes("platner")) {
        platner = candidate;
      }
    }

    const activeCandidates = candidates
      .filter(c => c.odds >= 1)
      .sort((a, b) => b.odds - a.odds);

    const candidatesWithTop2 = calculateTop2Probabilities(activeCandidates);

    const platnerWithTop2 = platner
      ? candidatesWithTop2.find(c => c.name.toLowerCase().includes("platner")) ?? null
      : null;

    return {
      source: "Polymarket",
      url: `https://polymarket.com/event/${POLYMARKET_EVENT_SLUG}`,
      candidates: candidatesWithTop2.slice(0, 15),
      platner: platnerWithTop2,
      total_volume: formatVolume(event.volume || 0),
      total_volume_raw: event.volume || 0,
      total_liquidity: formatVolume(event.liquidity || 0),
      total_liquidity_raw: event.liquidity || 0,
      fetched_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      source: "Polymarket",
      url: `https://polymarket.com/event/${POLYMARKET_EVENT_SLUG}`,
      candidates: [],
      platner: null,
      total_volume: "$0",
      fetched_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function fetchKalshi(): Promise<MarketData> {
  try {
    const baseUrl = "https://api.elections.kalshi.com/trade-api/v2";

    const url = `${baseUrl}/markets?event_ticker=${KALSHI_EVENT_TICKER}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const markets = data.markets || [];

    if (markets.length === 0) {
      return {
        source: "Kalshi",
        url: `https://kalshi.com/markets/kxsenatemed/med/kxsenatemed-26`,
        candidates: [],
        platner: null,
        total_volume: "$0",
        fetched_at: new Date().toISOString(),
        error: "No markets found",
      };
    }

    const candidates: Candidate[] = [];
    let platner: Candidate | null = null;
    let totalVolume = 0;

    for (const market of markets) {
      const name = market.no_sub_title || market.title || "";
      const party = (market.subtitle || "").replace(/::/g, "").trim();

      // API returns yes_bid_dollars as a string like "0.9810"; multiply by 100 for percentage
      const yesBidStr = market.yes_bid_dollars ?? market.last_price_dollars ?? "0";
      const odds = Math.round(parseFloat(yesBidStr) * 1000) / 10;

      const volume = parseFloat(market.volume_fp || market.volume || "0");
      totalVolume += volume;

      const candidate: Candidate = {
        name,
        odds,
        party,
        volume: formatVolume(volume),
        volume_raw: volume,
        ticker: market.ticker || "",
      };

      candidates.push(candidate);

      if (name.toLowerCase().includes("platner")) {
        platner = candidate;
      }
    }

    candidates.sort((a, b) => b.odds - a.odds);

    const activeCandidates = candidates.filter(c => c.odds > 0);
    const bidSum = activeCandidates.reduce((s, c) => s + c.odds, 0);
    const oddsSum = bidSum;

    const normalizedActive = activeCandidates.map(c => ({
      ...c,
      odds_normalized: Math.round((c.odds / bidSum) * 1000) / 10,
    }));
    const candidatesWithTop2 = calculateTop2Probabilities(normalizedActive);

    const platnerWithTop2 = platner
      ? candidatesWithTop2.find(c => c.name.toLowerCase().includes("platner")) ?? null
      : null;

    return {
      source: "Kalshi",
      url: `https://kalshi.com/markets/kxsenatemed/med/kxsenatemed-26`,
      candidates: candidatesWithTop2.slice(0, 15),
      platner: platnerWithTop2,
      total_volume: formatVolume(totalVolume),
      total_volume_raw: totalVolume,
      odds_sum: Math.round(oddsSum * 10) / 10,
      fetched_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      source: "Kalshi",
      url: `https://kalshi.com/markets/kxsenatemed/med/kxsenatemed-26`,
      candidates: [],
      platner: null,
      total_volume: "$0",
      fetched_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export { CANDIDATE };

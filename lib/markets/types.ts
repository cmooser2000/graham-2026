export interface Candidate {
  name: string;
  odds: number;
  odds_normalized?: number;
  top2_probability?: number;
  volume: string;
  volume_raw: number;
  change_1d?: number;
  change_1w?: number;
  party?: string;
  ticker?: string;
}

export interface MarketData {
  source: string;
  url: string;
  candidates: Candidate[];
  platner: Candidate | null;
  total_volume: string;
  total_volume_raw?: number;
  total_liquidity?: string;
  total_liquidity_raw?: number;
  odds_sum?: number;
  fetched_at: string;
  error?: string;
}

export interface MarketsResponse {
  candidate: string;
  average_odds: number | null;
  weighted_average_odds: number | null;
  average_top2: number | null;
  markets: {
    polymarket: MarketData;
    kalshi: MarketData;
  };
  fetched_at: string;
}

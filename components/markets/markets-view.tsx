"use client";

import { useState, useEffect, useCallback } from "react";
import type { MarketsResponse } from "@/lib/markets/types";
import { MarketCard } from "./market-card";
import { OddsLeaderboard } from "./odds-leaderboard";
import { PollsSection } from "./polls-section";
import { KpiStrip, KPI } from "@/components/ui/kpi-strip";

export function MarketsView() {
  const [markets, setMarkets] = useState<MarketsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(() => {
    fetch("/api/markets")
      .then(r => r.json())
      .then(setMarkets)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/markets")
      .then(r => r.json())
      .then(setMarkets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-refresh markets every 60s
  useEffect(() => {
    const interval = setInterval(fetchMarkets, 60_000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-terminal-yellow glow-yellow animate-pulse">Loading market data...</span>
      </div>
    );
  }

  const marketKpis: KPI[] = [];
  if (markets) {
    const kalshiCands = markets.markets.kalshi.candidates;
    const polyCands = markets.markets.polymarket.candidates;
    const fieldSize = Math.max(kalshiCands.length, polyCands.length);
    const totalVol = (markets.markets.kalshi.total_volume_raw ?? 0) + (markets.markets.polymarket.total_volume_raw ?? 0);
    const fmtVol = totalVol >= 1_000_000 ? `$${(totalVol / 1_000_000).toFixed(1)}M` : totalVol >= 1_000 ? `$${(totalVol / 1_000).toFixed(0)}K` : `$${totalVol}`;
    const leader = kalshiCands[0];

    marketKpis.push(
      { label: "WIN D PRIMARY", value: markets.weighted_average_odds !== null ? `${markets.weighted_average_odds}%` : "--", color: "yellow", sub: "Platner weighted avg" },
      { label: "TOP 2 (PRIMARY)", value: markets.average_top2 !== null ? `${markets.average_top2}%` : "--", color: "cyan", sub: "Harville model" },
      { label: "VOLUME", value: fmtVol, color: "dim", sub: "Kalshi + Polymarket" },
      { label: "CANDIDATES", value: `${fieldSize}`, color: "dim", sub: leader ? `Lead: ${leader.name.split(" ").pop()}` : "" },
    );
  }

  return (
    <div className="p-3 flex flex-col gap-3 overflow-auto">
      {/* Top-line KPIs */}
      {marketKpis.length > 0 && <KpiStrip kpis={marketKpis} />}

      {/* Market Cards - side by side */}
      {markets && (
        <div className="flex gap-2">
          <MarketCard market={markets.markets.kalshi} />
          <MarketCard market={markets.markets.polymarket} />
        </div>
      )}

      {/* General Election Market Notice */}
      <div className="bg-terminal-raised border border-terminal-yellow/20 rounded px-3 py-2.5 flex items-start gap-2">
        <span className="text-terminal-yellow text-terminal-sm shrink-0">⚡</span>
        <div className="flex flex-col gap-0.5">
          <span className="text-terminal-sm text-terminal-yellow font-semibold tracking-wider">GENERAL ELECTION MARKETS NOT LIVE YET</span>
          <span className="text-terminal-xs text-terminal-dim leading-relaxed">
            Kalshi and Polymarket do not yet have a Platner vs. Collins (Nov 2026) market. Platforms typically open general election markets after the primary. Maine primary is <span className="text-foreground">June 9, 2026</span> — expect general markets by June/July. Showing D primary nomination odds below.
          </span>
        </div>
      </div>

      {/* Odds Leaderboard */}
      {markets && (
        <OddsLeaderboard
          polymarket={markets.markets.polymarket}
          kalshi={markets.markets.kalshi}
        />
      )}

      {/* Polls */}
      <PollsSection />
    </div>
  );
}

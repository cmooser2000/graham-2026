"use client";

import { useState, useEffect, useCallback } from "react";
import type { MarketsResponse } from "@/lib/markets/types";
import { MarketCard } from "./market-card";
import { OddsLeaderboard } from "./odds-leaderboard";
import { PollsSection } from "./polls-section";
import { KpiStrip, KPI } from "@/components/ui/kpi-strip";

interface PollResult {
  candidate_name: string;
  matched_name?: string;
  matched_party?: string;
  party?: string;
  percentage: number;
}

interface Poll {
  id: number;
  pollster: string;
  end_date: string;
  results: PollResult[];
}

interface PollsResponse {
  poll_count: number;
  polls: Poll[];
}

function computeGeneralKpis(pollsData: PollsResponse | null): KPI[] {
  if (!pollsData || pollsData.poll_count === 0) return [];

  const totals: Record<string, { sum: number; count: number; party: string }> = {};
  for (const poll of pollsData.polls) {
    for (const r of poll.results) {
      const name = r.matched_name || r.candidate_name;
      if (!["Graham Platner", "Susan Collins"].includes(name)) continue;
      const party = r.matched_party || r.party || "";
      if (!totals[name]) totals[name] = { sum: 0, count: 0, party };
      totals[name].sum += r.percentage;
      totals[name].count += 1;
    }
  }

  const platner = totals["Graham Platner"];
  const collins = totals["Susan Collins"];
  if (!platner || !collins) return [];

  const pAvg = platner.sum / platner.count;
  const cAvg = collins.sum / collins.count;
  const margin = pAvg - cAvg;

  return [
    { label: "PLATNER (D)", value: `${pAvg.toFixed(1)}%`, color: "yellow", sub: `avg of ${platner.count} polls` },
    { label: "COLLINS (R)", value: `${cAvg.toFixed(1)}%`, color: "red", sub: `avg of ${collins.count} polls` },
    { label: "MARGIN", value: `${margin > 0 ? "+" : ""}${margin.toFixed(1)}`, color: margin > 0 ? "yellow" : "red", sub: margin > 0 ? "Platner leads" : "Collins leads" },
    { label: "POLLS", value: `${pollsData.poll_count}`, color: "dim", sub: "general election" },
  ];
}

export function MarketsView() {
  const [markets, setMarkets] = useState<MarketsResponse | null>(null);
  const [polls, setPolls] = useState<PollsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(() => {
    fetch("/api/markets")
      .then(r => r.json())
      .then(setMarkets)
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/markets").then(r => r.json()).catch(() => null),
      fetch("/api/polls?limit=30&race=ME-General").then(r => r.json()).catch(() => null),
    ]).then(([mkt, pol]) => {
      if (mkt) setMarkets(mkt);
      if (pol) setPolls(pol);
    }).finally(() => setLoading(false));
  }, []);

  // Auto-refresh markets every 60s
  useEffect(() => {
    const interval = setInterval(fetchMarkets, 60_000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-terminal-yellow glow-yellow animate-pulse">Loading...</span>
      </div>
    );
  }

  const generalKpis = computeGeneralKpis(polls);

  return (
    <div className="p-3 flex flex-col gap-3 overflow-auto">

      {/* ── GENERAL ELECTION ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-terminal-xs text-terminal-yellow font-semibold tracking-widest uppercase">General Election — Nov 3, 2026</span>
        <div className="flex-1 h-px bg-terminal-yellow/20" />
      </div>

      {/* Poll averages KPI strip */}
      {generalKpis.length > 0
        ? <KpiStrip kpis={generalKpis} />
        : (
          <div className="bg-terminal-panel border border-border rounded px-4 py-3 text-terminal-sm text-terminal-dim">
            No general election polls yet — will appear here as polling begins.
          </div>
        )
      }

      {/* General election polls detail */}
      <PollsSection />

      {/* General election betting market notice */}
      <div className="bg-terminal-raised border border-terminal-yellow/20 rounded px-3 py-2.5 flex items-start gap-2">
        <span className="text-terminal-yellow text-terminal-sm shrink-0">⚡</span>
        <div className="flex flex-col gap-0.5">
          <span className="text-terminal-sm text-terminal-yellow font-semibold tracking-wider">GENERAL ELECTION BETTING MARKETS NOT LIVE YET</span>
          <span className="text-terminal-xs text-terminal-dim leading-relaxed">
            Kalshi and Polymarket do not yet have a Platner vs. Collins market. Expect general markets to open in June/July after the June 9 primary.
          </span>
        </div>
      </div>

      {/* ── D PRIMARY NOMINATION MARKETS ─────────────────────────────── */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-terminal-xs text-terminal-dim font-semibold tracking-widest uppercase">D Primary Nomination Markets</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Primary market cards */}
      {markets && (
        <div className="flex gap-2">
          <MarketCard market={markets.markets.kalshi} />
          <MarketCard market={markets.markets.polymarket} />
        </div>
      )}

      {/* Primary odds leaderboard */}
      {markets && (
        <OddsLeaderboard
          polymarket={markets.markets.polymarket}
          kalshi={markets.markets.kalshi}
        />
      )}

    </div>
  );
}

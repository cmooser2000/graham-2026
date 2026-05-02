"use client";

import { useState } from "react";
import type { MarketData, Candidate } from "@/lib/markets/types";

interface OddsLeaderboardProps {
  polymarket: MarketData;
  kalshi: MarketData;
}

export function OddsLeaderboard({ polymarket, kalshi }: OddsLeaderboardProps) {
  const [activeTab, setActiveTab] = useState<"kalshi" | "polymarket">("kalshi");
  const market = activeTab === "kalshi" ? kalshi : polymarket;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="text-terminal-base text-terminal-dim font-medium tracking-wider uppercase">Candidate Odds</h3>
          <span className="text-terminal-xs text-terminal-dim tracking-wider">D PRIMARY</span>
        </div>
        <div className="flex gap-1">
          {(["kalshi", "polymarket"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 rounded text-terminal-sm transition-colors ${
                activeTab === tab
                  ? "bg-terminal-raised text-terminal-yellow border border-terminal-yellow/30"
                  : "bg-terminal-panel text-terminal-dim border border-border hover:text-foreground"
              }`}
            >
              {tab === "kalshi" ? "Kalshi" : "Polymarket"}
            </button>
          ))}
        </div>
      </div>

      {market.error ? (
        <div className="text-terminal-sm text-terminal-muted py-4 text-center">
          {market.error}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-terminal-sm text-terminal-dim">
            <span className="w-5">#</span>
            <span className="flex-1">Name</span>
            <span className="w-12 text-right">Win%</span>
            <span className="w-12 text-right">Top 2</span>
            <span className="w-16 text-right">Volume</span>
          </div>

          {market.candidates.map((c: Candidate, i: number) => {
            const isPlatner = c.name.toLowerCase().includes("platner");
            return (
              <div
                key={c.name}
                className={`flex items-center gap-2 px-3 py-1.5 rounded ${
                  isPlatner
                    ? "bg-terminal-yellow/10 border border-terminal-yellow/20"
                    : "bg-terminal-panel border border-border"
                }`}
              >
                <span className="text-terminal-sm text-terminal-muted w-5">{i + 1}</span>
                <span className={`text-terminal-base flex-1 truncate ${
                  isPlatner ? "text-terminal-yellow font-medium" : ""
                }`}>
                  {c.name}
                </span>
                <span className={`text-terminal-base tabular-nums w-12 text-right font-semibold ${
                  isPlatner ? "text-terminal-yellow" : "text-foreground"
                }`}>
                  {(c.odds_normalized ?? c.odds)}%
                </span>
                <span className="text-terminal-base tabular-nums w-12 text-right text-terminal-yellow">
                  {c.top2_probability ? `${c.top2_probability}%` : "-"}
                </span>
                <span className="text-terminal-sm tabular-nums w-16 text-right text-terminal-dim">
                  {c.volume}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

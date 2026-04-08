"use client";

import type { MarketData } from "@/lib/markets/types";

interface MarketCardProps {
  market: MarketData;
}

export function MarketCard({ market }: MarketCardProps) {
  const platner = market.platner;
  const hasNormalization = market.odds_sum && market.odds_sum > 100;

  return (
    <div className="flex-1 bg-terminal-panel border border-border rounded p-3 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-terminal-sm text-terminal-blue font-semibold tracking-widest uppercase">
          {market.source}
        </span>
        {market.error && (
          <span className="text-terminal-xs text-terminal-red">ERR</span>
        )}
      </div>

      {platner ? (
        <>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-terminal-xl text-terminal-yellow tabular-nums font-semibold">
              {(platner.odds_normalized ?? platner.odds)}%
            </span>
            {hasNormalization && (
              <span className="text-terminal-xs text-terminal-dim">
                ({market.odds_sum}%&rarr;100%)
              </span>
            )}
          </div>

          {platner.top2_probability && (
            <div className="mb-2">
              <span className="text-terminal-xs text-terminal-dim">TOP 2: </span>
              <span className="text-terminal-sm text-terminal-yellow tabular-nums">
                {platner.top2_probability}%
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 text-terminal-sm text-terminal-dim">
            <span>VOL {market.total_volume}</span>
            {platner.change_1d !== undefined && platner.change_1d !== 0 && (
              <span className={platner.change_1d > 0 ? "text-green-400" : "text-terminal-red"}>
                24h {platner.change_1d > 0 ? "+" : ""}{(platner.change_1d * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </>
      ) : (
        <span className="text-terminal-sm text-terminal-muted">
          {market.error || "No data"}
        </span>
      )}

      <a
        href={market.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-2 text-terminal-sm text-terminal-cyan hover:text-terminal-yellow transition-colors"
      >
        View Market &rarr;
      </a>
    </div>
  );
}

"use client";

interface OddsHeroProps {
  winPct: number | null;
  top2Pct: number | null;
  label?: string;
}

export function OddsHero({ winPct, top2Pct, label = "Liquidity-weighted avg" }: OddsHeroProps) {
  return (
    <div className="bg-terminal-panel border border-terminal-yellow/20 rounded px-4 py-4 flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-terminal-base text-terminal-dim font-medium tracking-wider uppercase">Win Probability</span>
        <span className="text-terminal-hero text-terminal-yellow glow-yellow tabular-nums">
          {winPct !== null ? `${winPct}%` : "--"}
        </span>
        <span className="text-terminal-xs text-terminal-dim mt-0.5">{label}</span>
      </div>
      {top2Pct !== null && (
        <div className="flex flex-col items-end">
          <span className="text-terminal-base text-terminal-dim font-medium tracking-wider uppercase">Top 2 Finish</span>
          <span className="text-terminal-xl text-terminal-yellow tabular-nums font-semibold">
            {top2Pct}%
          </span>
          <span className="text-terminal-xs text-terminal-dim mt-0.5">Harville model</span>
        </div>
      )}
    </div>
  );
}

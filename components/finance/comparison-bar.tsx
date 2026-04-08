"use client";

import { formatCurrency } from "./format";

interface BarData {
  name: string;
  value: number;
  party: string;
  candidateId?: number;
}

interface ComparisonBarProps {
  data: BarData[];
  label?: string;
  formatAsCurrency?: boolean;
  onSelect?: (candidateId: number) => void;
}

export function ComparisonBar({ data, label, formatAsCurrency = true, onSelect }: ComparisonBarProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex flex-col gap-0.5">
      {label && (
        <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase mb-1">
          {label}
        </span>
      )}
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        const isSwalwell = d.name === "Graham Platner";
        const barColor = isSwalwell
          ? "bg-terminal-yellow/80"
          : d.party === "R"
          ? "bg-red-500/50"
          : "bg-terminal-blue/50";
        const textColor = isSwalwell ? "text-terminal-yellow" : "text-foreground";

        return (
          <button
            key={d.name}
            onClick={() => d.candidateId && onSelect?.(d.candidateId)}
            className="flex items-center gap-2 py-1 px-1 -mx-1 rounded hover:bg-terminal-raised/50 transition-colors text-left group"
          >
            <span className={`text-terminal-xs w-28 sm:w-36 truncate flex-shrink-0 ${textColor}`}>
              {d.name}
              <span className="text-terminal-muted ml-1 text-[9px]">
                ({d.party})
              </span>
            </span>
            <div className="flex-1 h-4 bg-terminal-bg rounded overflow-hidden">
              <div
                className={`h-full rounded transition-all ${barColor}`}
                style={{ width: `${Math.max(pct, 1)}%` }}
              />
            </div>
            <span className={`text-terminal-xs tabular-nums flex-shrink-0 w-20 text-right ${textColor}`}>
              {formatAsCurrency ? formatCurrency(d.value) : d.value.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

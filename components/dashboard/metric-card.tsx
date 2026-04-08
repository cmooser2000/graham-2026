"use client";

import { DashboardMetric } from "@/lib/data/types";
import { Sparkline } from "./sparkline";

function formatValue(value: number, format: DashboardMetric["format"]): string {
  switch (format) {
    case "currency":
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
      return `$${value.toFixed(0)}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "compact":
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
      return value.toFixed(0);
    default:
      return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  }
}

export function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <div className="flex items-center gap-3 bg-terminal-panel border border-border rounded px-3 py-2">
      <span className="text-terminal-xs text-terminal-blue font-medium tracking-wider uppercase w-[110px] shrink-0 truncate">
        {metric.label}
      </span>
      <span className="text-terminal-lg text-terminal-yellow glow-yellow tabular-nums font-semibold shrink-0">
        {formatValue(metric.value, metric.format)}
      </span>
      {metric.sparkline.length > 0 && (
        <div className="flex-1 min-w-[60px]">
          <Sparkline data={metric.sparkline} height={20} />
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface TrendRow {
  name: string;
  party: string;
  date: string;
  search_interest: number;
}

interface CandidateAnalytics {
  peak: { date: string };
  trendDirection: "rising" | "falling" | "flat" | null;
  rank: number;
  dataPoints: number;
  nonZeroDataPoints: number;
  hasPartialData: boolean;
}

interface TrendsResponse {
  timeSeries: TrendRow[];
  analytics: Record<string, CandidateAnalytics>;
  meta: {
    dateRange: { from: string | null; to: string | null };
    lastDataDate: string | null;
    totalDataPoints: number;
    candidateCount: number;
    note: string;
  };
}

const COLORS = ["#FFD700", "#4488FF", "#ff4444", "#66bbff", "#8855ff", "#33ff88", "#ff8844", "#ff44aa", "#44ffaa"];

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TrendArrow({ direction }: { direction: string | null }) {
  if (direction === null) {
    return <span className="text-terminal-dim" title="Insufficient data for trend">--</span>;
  }
  if (direction === "rising") {
    return <span className="text-terminal-green">{"\u25B2"}</span>;
  }
  if (direction === "falling") {
    return <span className="text-terminal-red">{"\u25BC"}</span>;
  }
  return <span className="text-terminal-dim">{"\u25C6"}</span>;
}

export function TrendsChart() {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/interest/trends")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const { chartData, candidates } = useMemo(() => {
    if (!data?.timeSeries?.length) return { chartData: [], candidates: [] };

    const byDate: Record<string, Record<string, number>> = {};
    const candidateSet = new Set<string>();
    for (const row of data.timeSeries) {
      candidateSet.add(row.name);
      if (!byDate[row.date]) byDate[row.date] = {};
      byDate[row.date][row.name] = row.search_interest;
    }
    const dates = Object.keys(byDate).sort();
    const chartData = dates.map(date => ({
      date: formatDate(date),
      ...byDate[date],
    }));
    return { chartData, candidates: Array.from(candidateSet) };
  }, [data]);

  // Sorted leaderboard by rank, with partial-data candidates separated
  const { ranked, sparse } = useMemo(() => {
    if (!data?.analytics) return { ranked: [], sparse: [] };
    const entries = Object.entries(data.analytics)
      .sort(([, a], [, b]) => a.rank - b.rank)
      .map(([name, stats]) => ({ name, ...stats }));
    return {
      ranked: entries.filter(c => !c.hasPartialData),
      sparse: entries.filter(c => c.hasPartialData),
    };
  }, [data]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><span className="text-terminal-yellow glow-yellow animate-pulse">Loading...</span></div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-terminal-red">ERROR: {error}</span>
      </div>
    );
  }

  if (!data?.timeSeries?.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-terminal-dim">No Google Trends data available</span>
      </div>
    );
  }

  const allCandidates = [...ranked, ...sparse];

  // Build color map keyed by candidate name so chart + leaderboard match
  const colorMap: Record<string, string> = {};
  candidates.forEach((name, i) => {
    colorMap[name] = COLORS[i % COLORS.length];
  });

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-terminal-base text-terminal-blue font-semibold tracking-widest uppercase">Search Rankings (ME)</h3>
        <span className="text-terminal-sm text-terminal-dim">
          {data.meta.lastDataDate
            ? `as of ${formatDate(data.meta.lastDataDate)}`
            : "relative interest"}
        </span>
      </div>

      {/* Leaderboard — candidates with sufficient data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-1.5">
        {ranked.map(c => (
          <div key={c.name} className="bg-terminal-panel border border-border rounded px-2.5 py-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-terminal-sm text-terminal-amber font-semibold w-6 shrink-0 tabular-nums">#{c.rank}</span>
              <span className="text-terminal-sm font-medium truncate" style={{ color: colorMap[c.name] || "#727290" }}>
                {c.name.split(" ").pop()}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-terminal-xs text-terminal-dim">
                peaked {formatDate(c.peak.date)}
              </span>
              <span className="text-terminal-sm">
                <TrendArrow direction={c.trendDirection} />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Sparse-data candidates — dimmed, separated */}
      {sparse.length > 0 && (
        <div className="mb-3">
          <div className="text-terminal-xs text-terminal-dim mb-1 uppercase tracking-wider">Insufficient search data</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {sparse.map(c => (
              <div key={c.name} className="bg-terminal-bg border border-border/50 rounded px-2 py-1 flex items-center justify-between gap-1 opacity-60">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-terminal-xs text-terminal-dim w-5 shrink-0 tabular-nums">#{c.rank}</span>
                  <span className="text-terminal-xs text-terminal-dim truncate">
                    {c.name.split(" ").pop()}
                  </span>
                </div>
                <span className="text-terminal-xs text-terminal-dim shrink-0" title={`${c.nonZeroDataPoints}/${c.dataPoints} non-zero days`}>
                  {c.nonZeroDataPoints}/{c.dataPoints}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart — Y-axis hidden since absolute values are meaningless */}
      <div className="h-[250px] sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#727290" }} interval={Math.max(1, Math.floor(chartData.length / 6))} />
            <YAxis tick={false} axisLine={false} width={8} />
            <Tooltip
              contentStyle={{ background: "#1c1e2d", border: "1px solid #FFD700", fontSize: 11, fontFamily: "Berkeley Mono, monospace" }}
              labelStyle={{ color: "#FFD700" }}
              formatter={(_value: number | undefined, name?: string) => {
                // Show relative position instead of raw value
                const rank = allCandidates.findIndex(c => c.name === name || c.name.split(" ").pop() === name) + 1;
                return [rank > 0 ? `Rank #${rank}` : "—", name ?? ""];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} className="hidden sm:block" />
            {candidates.map((name) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={colorMap[name] || "#727290"}
                strokeWidth={1.5}
                dot={false}
                name={name.split(" ").pop()}
                strokeOpacity={data.analytics[name]?.hasPartialData ? 0.3 : 1}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Data provenance */}
      <div className="mt-2 text-terminal-xs text-terminal-dim">
        {data.meta.dateRange.from && data.meta.dateRange.to &&
          `${formatDate(data.meta.dateRange.from)} \u2013 ${formatDate(data.meta.dateRange.to)} \u00B7 `}
        {data.meta.note}
      </div>
    </div>
  );
}

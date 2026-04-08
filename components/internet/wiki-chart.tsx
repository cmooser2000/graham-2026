"use client";

import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface WikiRow {
  name: string;
  date: string;
  views: number;
}

interface CandidateAnalytics {
  totalViews: number;
  avgDaily: number;
  medianDaily: number;
  avg7d: number | null;
  avg7dDataPoints: number;
  peakDate: string;
  peakViews: number;
  latestViews: number;
  trendDirection: "up" | "down" | "flat" | null;
  trendPct: number | null;
  dataPoints: number;
  rank: number;
  spikes: { date: string; views: number; multiple: number }[];
}

interface WikiResponse {
  timeSeries: WikiRow[];
  analytics: Record<string, CandidateAnalytics>;
  meta: {
    dateRange: { from: string | null; to: string | null };
    lastDataDate: string | null;
    totalDataPoints: number;
    candidateCount: number;
    incompleteCandidates: string[];
    source: string;
  };
}

const COLORS = ["#FFD700", "#4488FF", "#ff4444", "#66bbff", "#8855ff", "#33ff88", "#ff8844", "#ff44aa", "#44ffaa"];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TrendArrow({ direction, pct }: { direction: "up" | "down" | "flat" | null; pct: number | null }) {
  if (direction === null || pct === null) {
    return <span className="text-terminal-dim">N/A</span>;
  }
  if (direction === "up") {
    return <span className="text-terminal-green">{"\u2191"} +{Math.abs(pct)}%</span>;
  }
  if (direction === "down") {
    return <span className="text-terminal-red">{"\u2193"} {pct}%</span>;
  }
  return <span className="text-terminal-dim">{"\u2192"} 0%</span>;
}

export function WikiChart() {
  const [data, setData] = useState<WikiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [smoothed, setSmoothed] = useState(false);

  useEffect(() => {
    fetch("/api/interest/wiki")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch(e => setError(e.message || "Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  // Build chart data: daily or 7-day rolling average
  const { chartData, candidates } = useMemo(() => {
    if (!data?.timeSeries?.length) return { chartData: [], candidates: [] };

    const candidateSet = new Set<string>();
    // Group by candidate then by date for rolling average computation
    const byCandidateDate: Record<string, Record<string, number>> = {};
    for (const row of data.timeSeries) {
      candidateSet.add(row.name);
      if (!byCandidateDate[row.name]) byCandidateDate[row.name] = {};
      byCandidateDate[row.name][row.date] = Number(row.views);
    }

    const allDates = [...new Set(data.timeSeries.map(r => r.date))].sort();
    const candidateNames = Array.from(candidateSet);

    if (!smoothed) {
      // Daily values
      const chartData = allDates.map(date => {
        const point: Record<string, string | number> = { date: formatDate(date) };
        for (const name of candidateNames) {
          point[name] = byCandidateDate[name]?.[date] ?? 0;
        }
        return point;
      });
      return { chartData, candidates: candidateNames };
    }

    // 7-day rolling average
    const chartData = allDates.map((date, i) => {
      const point: Record<string, string | number> = { date: formatDate(date) };
      for (const name of candidateNames) {
        const windowStart = Math.max(0, i - 6); // 7 days including current
        let sum = 0;
        let count = 0;
        for (let j = windowStart; j <= i; j++) {
          const v = byCandidateDate[name]?.[allDates[j]];
          if (v !== undefined) {
            sum += v;
            count++;
          }
        }
        point[name] = count > 0 ? Math.round(sum / count) : 0;
      }
      return point;
    });
    return { chartData, candidates: candidateNames };
  }, [data, smoothed]);

  // Leaderboard sorted by rank (total views descending)
  const leaderboard = useMemo(() => {
    if (!data?.analytics) return [];
    return Object.entries(data.analytics)
      .sort(([, a], [, b]) => a.rank - b.rank)
      .map(([name, stats]) => ({ name, ...stats }));
  }, [data]);

  // Collect all spikes across candidates, sorted by multiple descending
  const allSpikes = useMemo(() => {
    if (!data?.analytics) return [];
    const spikes: { name: string; date: string; views: number; multiple: number }[] = [];
    for (const [name, stats] of Object.entries(data.analytics)) {
      for (const spike of stats.spikes) {
        spikes.push({ name, ...spike });
      }
    }
    return spikes.sort((a, b) => b.multiple - a.multiple);
  }, [data]);

  // Map candidate names to stable colors based on rank order
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    leaderboard.forEach((c, i) => {
      map[c.name] = COLORS[i % COLORS.length];
    });
    return map;
  }, [leaderboard]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><span className="text-terminal-yellow glow-yellow animate-pulse">Loading...</span></div>;
  }

  if (error) {
    return (
      <div className="p-3">
        <h3 className="text-terminal-base text-terminal-blue font-semibold tracking-widest uppercase mb-2">Wikipedia Pageviews</h3>
        <div className="flex items-center gap-2 text-terminal-red text-terminal-sm">
          <span>ERR</span>
          <span className="text-terminal-dim">{error}</span>
        </div>
      </div>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="p-3">
        <h3 className="text-terminal-base text-terminal-blue font-semibold tracking-widest uppercase mb-2">Wikipedia Pageviews</h3>
        <div className="text-terminal-dim text-terminal-sm">No pageview data available</div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-terminal-base text-terminal-blue font-semibold tracking-widest uppercase">Wikipedia Pageviews</h3>
        <div className="flex items-center gap-3 text-terminal-xs text-terminal-dim">
          {data.meta.dateRange.from && data.meta.dateRange.to && (
            <span>{formatDate(data.meta.dateRange.from)} {"\u2013"} {formatDate(data.meta.dateRange.to)}</span>
          )}
          <span>{data.meta.source}</span>
        </div>
      </div>

      {/* Leaderboard — sorted by total views */}
      {leaderboard.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
          {leaderboard.map((c) => (
            <div key={c.name} className="bg-terminal-panel border border-border rounded px-2.5 py-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-terminal-sm text-terminal-dim w-4 shrink-0">#{c.rank}</span>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorMap[c.name] }} />
                <span className="text-terminal-sm font-medium whitespace-nowrap" style={{ color: colorMap[c.name] }}>
                  {c.name.split(" ").pop()}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-terminal-xs text-terminal-dim">
                  tot <span className="text-foreground tabular-nums">{formatNumber(c.totalViews)}</span>
                </span>
                <span className="text-terminal-xs text-terminal-dim">
                  med <span className="text-foreground tabular-nums">{formatNumber(c.medianDaily)}</span>/d
                </span>
                <span className="text-terminal-xs text-terminal-dim">
                  avg <span className="text-foreground tabular-nums">{formatNumber(c.avgDaily)}</span>/d
                </span>
                <span className="text-terminal-xs tabular-nums">
                  <TrendArrow direction={c.trendDirection} pct={c.trendPct} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart with smoothing toggle */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-terminal-xs text-terminal-dim">
          {smoothed ? "7-day rolling average" : "daily views"}
        </span>
        <button
          onClick={() => setSmoothed(s => !s)}
          className={`text-terminal-xs px-2 py-0.5 rounded border transition-colors ${
            smoothed
              ? "border-terminal-yellow/40 text-terminal-yellow bg-terminal-yellow/10"
              : "border-terminal-dim/20 text-terminal-dim hover:text-terminal-yellow hover:border-terminal-yellow/30"
          }`}
        >
          {smoothed ? "7D AVG" : "SMOOTH"}
        </button>
      </div>

      <div className="h-[250px] sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#727290" }} interval={Math.max(1, Math.floor(chartData.length / 6))} />
            <YAxis tick={{ fontSize: 10, fill: "#727290" }} width={45} />
            <Tooltip
              contentStyle={{ background: "#1c1e2d", border: "1px solid #FFD700", fontSize: 11, fontFamily: "Berkeley Mono, monospace" }}
              labelStyle={{ color: "#FFD700" }}
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
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Notable spikes */}
      {allSpikes.length > 0 && (
        <div className="mt-3 bg-terminal-panel border border-border rounded p-2.5">
          <h4 className="text-terminal-xs text-terminal-blue font-medium uppercase tracking-widest mb-2">Spikes ({"\u003E"}3x median)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {allSpikes.slice(0, 8).map((spike, i) => (
              <div key={`${spike.name}-${spike.date}-${i}`} className="flex items-center justify-between text-terminal-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-terminal-dim w-12 shrink-0 tabular-nums">{formatDate(spike.date)}</span>
                  <span className="font-medium truncate" style={{ color: colorMap[spike.name] }}>
                    {spike.name.split(" ").pop()}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-foreground tabular-nums">{formatNumber(spike.views)}</span>
                  <span className="text-terminal-amber tabular-nums font-semibold">{spike.multiple}x</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data provenance */}
      <div className="mt-2 text-terminal-xs text-terminal-dim">
        {data.meta.dateRange.from && data.meta.dateRange.to &&
          `${formatDate(data.meta.dateRange.from)} \u2013 ${formatDate(data.meta.dateRange.to)} \u00B7 `}
        {data.meta.totalDataPoints.toLocaleString()} pts {"\u00B7"} {data.meta.candidateCount} candidates {"\u00B7"} {data.meta.source}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "./metric-card";
import { FinanceTable } from "./finance-table";
import { formatCurrency, formatNumber, formatPct } from "./format";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface FundraisingTabProps {
  candidateId: number | null;
  onSelectCandidate: (id: number) => void;
}

const CANDIDATE_COLORS: Record<string, string> = {
  "Graham Platner": "#FFD700",
  "Katie Porter": "#ff6b6b",
  "Tony Thurmond": "#51cf66",
  "Janet Mills": "#4488FF",
  "Betty Yee": "#22b8cf",
  "Susan Collins": "#ff4444",
  "Matt Mahan": "#74b9ff",
  "Rick Caruso": "#f9ca24",
};

const SIZE_BUCKETS = ["small", "medium", "large", "major"] as const;
const SIZE_LABELS: Record<string, string> = {
  small: "<$100",
  medium: "$100-499",
  large: "$500-999",
  major: "$1,000+",
};
const SIZE_COLORS: Record<string, string> = {
  small: "#66bbff",
  medium: "#4488FF",
  large: "#cc5de8",
  major: "#FFD700",
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#0f1117",
    border: "1px solid #262840",
    fontSize: 11,
    borderRadius: 4,
  },
  cursor: { fill: "rgba(255,255,255,0.03)" },
};

export function FundraisingTab({ candidateId, onSelectCandidate }: FundraisingTabProps) {
  const [contributions, setContributions] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [allBreakdown, setAllBreakdown] = useState<{ by_size: any[]; by_type: any[] }>({ by_size: [], by_type: [] });
  const [candidateData, setCandidateData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (candidateId) {
      fetch(`/api/finance/candidate/${candidateId}`)
        .then((r) => r.json())
        .then(setCandidateData)
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        fetch("/api/finance/contributions").then((r) => r.json()),
        fetch("/api/finance/timeline").then((r) => r.json()),
        fetch("/api/finance/contributions-breakdown").then((r) => r.json()),
      ])
        .then(([c, t, bd]) => {
          setContributions(c);
          setTimeline(t);
          setAllBreakdown(bd);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [candidateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-terminal-yellow glow-yellow animate-pulse">Loading...</span>
      </div>
    );
  }

  // ─── Candidate drill-down ─────────────────────────────────────────
  if (candidateId && candidateData) {
    return <CandidateDrillDown data={candidateData} />;
  }

  // ─── Comparison mode (all candidates) ─────────────────────────────
  return (
    <ComparisonView
      contributions={contributions}
      timeline={timeline}
      breakdown={allBreakdown}
      onSelectCandidate={onSelectCandidate}
    />
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPARISON VIEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ComparisonView({
  contributions,
  timeline,
  breakdown,
  onSelectCandidate,
}: {
  contributions: any[];
  timeline: any[];
  breakdown: { by_size: any[]; by_type: any[] };
  onSelectCandidate: (id: number) => void;
}) {
  // Build stacked bar data: each candidate row with size bucket amounts
  const sizeByCandidate = buildSizeByCandidate(breakdown.by_size);

  // Build timeline chart data: pivot by month with each candidate as a column
  const months = [...new Set(timeline.map((t: any) => t.month))].sort();
  const candidates = [...new Set(timeline.map((t: any) => t.name))];
  const chartData = months.map((m) => {
    const row: any = { month: formatMonth(m) };
    candidates.forEach((name) => {
      const entry = timeline.find((t: any) => t.month === m && t.name === name);
      row[name] = entry ? parseFloat(entry.contributions) : 0;
    });
    return row;
  });

  // Field totals
  const totalRaised = contributions.reduce((s, c) => s + (parseFloat(c.total_raised) || 0), 0);
  const totalDonors = contributions.reduce((s, c) => s + (parseInt(c.unique_donors) || 0), 0);

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Hero metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Field Total Raised" value={formatCurrency(totalRaised)} />
        <MetricCard label="Total Unique Donors" value={formatNumber(totalDonors)} color="cyan" />
        <MetricCard
          label="Highest Raised"
          value={contributions[0]?.name?.split(" ").pop() || "--"}
          subtitle={formatCurrency(contributions[0]?.total_raised)}
        />
        <MetricCard
          label="Highest Avg"
          value={(() => {
            const sorted = [...contributions].sort((a, b) => parseFloat(b.avg_contribution || 0) - parseFloat(a.avg_contribution || 0));
            return sorted[0]?.name?.split(" ").pop() || "--";
          })()}
          subtitle={(() => {
            const sorted = [...contributions].sort((a, b) => parseFloat(b.avg_contribution || 0) - parseFloat(a.avg_contribution || 0));
            return formatCurrency(sorted[0]?.avg_contribution);
          })()}
          color="green"
        />
      </div>

      {/* Stacked bar chart: fundraising by size bucket per candidate */}
      {sizeByCandidate.length > 0 && (
        <div className="bg-terminal-panel border border-border rounded p-3">
          <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
            Contributions by Size Bucket
          </span>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sizeByCandidate} layout="vertical" margin={{ left: 90, right: 12, top: 4, bottom: 4 }}>
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#727290" }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#d8d8e8" }}
                  width={85}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: any, name: any) => [formatCurrency(v as number), SIZE_LABELS[name] || name]}
                />
                <Legend
                  formatter={(value) => SIZE_LABELS[value] || value}
                  wrapperStyle={{ fontSize: 10 }}
                />
                {SIZE_BUCKETS.map((bucket) => (
                  <Bar
                    key={bucket}
                    dataKey={bucket}
                    stackId="size"
                    fill={SIZE_COLORS[bucket]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly fundraising timeline */}
      {chartData.length > 0 && (
        <div className="bg-terminal-panel border border-border rounded p-3">
          <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
            Monthly Fundraising
          </span>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#727290" }} />
                <YAxis tick={{ fontSize: 10, fill: "#727290" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: any, name: any) => [formatCurrency(v as number), name]}
                />
                {candidates.map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CANDIDATE_COLORS[name] || "#727290"}
                    strokeWidth={name === "Graham Platner" ? 2 : 1}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Comparison table */}
      <FinanceTable
        columns={[
          { key: "name", label: "Candidate" },
          { key: "total_raised", label: "Raised", align: "right", format: formatCurrency },
          { key: "unique_donors", label: "Donors", align: "right", format: formatNumber },
          { key: "avg_contribution", label: "Avg", align: "right", format: formatCurrency },
          { key: "repeat_donor_rate", label: "Repeat %", align: "right", format: formatPct },
        ]}
        rows={contributions}
        onRowClick={(row) => row.candidate_id && onSelectCandidate(row.candidate_id)}
      />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CANDIDATE DRILL-DOWN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CandidateDrillDown({ data }: { data: any }) {
  const c = data.contributions;
  const tl = data.timeline || [];
  const bySize = data.contributions_by_size || [];
  const byType = data.contributions_by_type || [];
  const topDonors = data.top_donors || [];
  const candidateColor = CANDIDATE_COLORS[data.candidate.name] || "#FFD700";

  // Monthly timeline bar chart data
  const monthlyData = tl.map((t: any) => ({
    month: formatMonth(t.month),
    amount: parseFloat(t.contributions) || 0,
  }));

  // Breakdown chart data
  const sizeData = bySize.map((b: any) => ({
    label: SIZE_LABELS[b.size_bucket] || b.size_bucket,
    amount: parseFloat(b.amount) || 0,
    count: parseInt(b.count) || 0,
  }));

  const typeData = byType.map((b: any) => ({
    label: b.donor_type,
    amount: parseFloat(b.amount) || 0,
    count: parseInt(b.count) || 0,
  }));

  const TYPE_COLORS = ["#4488FF", "#cc5de8", "#ff922b", "#51cf66"];

  return (
    <div className="p-3 flex flex-col gap-3">
      <h3 className="text-terminal-sm text-terminal-dim tracking-wider uppercase">
        Fundraising — <span style={{ color: candidateColor }}>{data.candidate.name}</span>
      </h3>

      {/* Hero metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Total Raised" value={formatCurrency(c?.total_raised)} />
        <MetricCard label="Unique Donors" value={formatNumber(c?.unique_donors)} color="cyan" />
        <MetricCard label="Avg Contribution" value={formatCurrency(c?.avg_contribution)} color="green" />
        <MetricCard
          label="Repeat Donors"
          value={formatPct(c?.repeat_donor_rate)}
          subtitle={`${formatNumber(c?.repeat_donor_count)} repeat | ${formatNumber(c?.unique_donors)} unique`}
        />
      </div>

      {/* Monthly fundraising bar chart */}
      {monthlyData.length > 0 && (
        <div className="bg-terminal-panel border border-border rounded p-3">
          <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
            Monthly Contributions
          </span>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#727290" }} />
                <YAxis tick={{ fontSize: 10, fill: "#727290" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: any) => [formatCurrency(v as number), "Contributions"]}
                />
                <Bar dataKey="amount" radius={[2, 2, 0, 0]}>
                  {monthlyData.map((_: any, i: number) => (
                    <Cell key={i} fill={candidateColor} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Breakdown charts side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* By size bucket */}
        {sizeData.length > 0 && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">By Size</span>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sizeData} layout="vertical" margin={{ left: 50, right: 12, top: 4, bottom: 4 }}>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#727290" }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#d8d8e8" }} width={48} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: any) => [formatCurrency(v as number), "Amount"]}
                  />
                  <Bar dataKey="amount" radius={[0, 2, 2, 0]}>
                    {sizeData.map((d: any, i: number) => {
                      const bucket = bySize[i]?.size_bucket;
                      return <Cell key={i} fill={SIZE_COLORS[bucket] || "#4488FF"} fillOpacity={0.85} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* By donor type */}
        {typeData.length > 0 && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">By Type</span>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical" margin={{ left: 70, right: 12, top: 4, bottom: 4 }}>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#727290" }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#d8d8e8" }} width={65} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: any) => [formatCurrency(v as number), "Amount"]}
                  />
                  <Bar dataKey="amount" radius={[0, 2, 2, 0]}>
                    {typeData.map((_: any, i: number) => (
                      <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Top donors table */}
      {topDonors.length > 0 && (
        <div className="bg-terminal-panel border border-border rounded p-3">
          <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
            Top Donors
          </span>
          <FinanceTable
            columns={[
              { key: "donor_name", label: "Donor" },
              { key: "amount", label: "Amount", align: "right", format: formatCurrency },
              { key: "donations", label: "Donations", align: "right", format: formatNumber },
            ]}
            rows={topDonors}
            highlightName=""
            maxRows={15}
          />
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildSizeByCandidate(bySizeRows: any[]): any[] {
  const map = new Map<string, any>();
  for (const row of bySizeRows) {
    const name = row.name;
    if (!map.has(name)) {
      map.set(name, { name, candidateId: row.candidate_id, small: 0, medium: 0, large: 0, major: 0 });
    }
    const entry = map.get(name)!;
    const bucket = row.size_bucket;
    if (bucket && entry[bucket] !== undefined) {
      entry[bucket] = parseFloat(row.amount) || 0;
    }
  }
  // Sort by total descending
  return [...map.values()].sort((a, b) => {
    const totalA = a.small + a.medium + a.large + a.major;
    const totalB = b.small + b.medium + b.large + b.major;
    return totalB - totalA;
  });
}

function formatMonth(monthStr: string): string {
  if (!monthStr) return "";
  const d = new Date(monthStr + "-01");
  if (isNaN(d.getTime())) return monthStr;
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

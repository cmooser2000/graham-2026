"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "./metric-card";
import { ComparisonBar } from "./comparison-bar";
import { FinanceTable } from "./finance-table";
import { formatCurrency, formatNumber } from "./format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CATEGORY_COLORS: Record<string, string> = {
  "Media/Ads": "#FFD700",
  Consultants: "#4488FF",
  Staff: "#51cf66",
  Events: "#ff922b",
  Travel: "#cc5de8",
  Overhead: "#66bbff",
  Legal: "#ff6b6b",
  Other: "#727290",
};

const CANDIDATE_COLORS: Record<string, string> = {
  "Graham Platner": "#FFD700",
  "Susan Collins": "#ff4444",
  "Janet Mills": "#4488FF",
};

interface SpendingTabProps {
  candidateId: number | null;
  onSelectCandidate: (id: number) => void;
}

export function SpendingTab({ candidateId, onSelectCandidate }: SpendingTabProps) {
  const [spending, setSpending] = useState<any[]>([]);
  const [allBreakdown, setAllBreakdown] = useState<{ by_category: any[]; vendors: any[] }>({ by_category: [], vendors: [] });
  const [breakdown, setBreakdown] = useState<{ by_category: any[]; vendors: any[] }>({ by_category: [], vendors: [] });
  const [candidateData, setCandidateData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (candidateId) {
      Promise.all([
        fetch(`/api/finance/candidate/${candidateId}`).then((r) => r.json()),
        fetch(`/api/finance/spending-breakdown?candidate_id=${candidateId}`).then((r) => r.json()),
      ])
        .then(([cand, bd]) => {
          setCandidateData(cand);
          setBreakdown(bd);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        fetch("/api/finance/spending").then((r) => r.json()),
        fetch("/api/finance/spending-breakdown").then((r) => r.json()),
      ])
        .then(([s, bd]) => {
          setSpending(s);
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

  // Drill-down mode
  if (candidateId && candidateData) {
    const s = candidateData.spending;
    const maxCat = Math.max(...breakdown.by_category.map((c) => parseFloat(c.amount) || 0), 1);

    return (
      <div className="p-3 flex flex-col gap-3">
        <h3 className="text-terminal-sm text-terminal-dim tracking-wider uppercase">
          Spending — {candidateData.candidate.name}
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Total Spending" value={formatCurrency(s?.total_spending)} />
          <MetricCard label="Expenditures" value={formatNumber(s?.expenditure_count)} color="cyan" />
        </div>

        {/* Category breakdown with proportional bars */}
        {breakdown.by_category.length > 0 && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
              Spending by Category
            </span>
            <div className="flex flex-col gap-1">
              {breakdown.by_category.map((cat: any) => {
                const amt = parseFloat(cat.amount) || 0;
                const pct = (amt / maxCat) * 100;
                const color = CATEGORY_COLORS[cat.category] || "#727290";
                return (
                  <div key={cat.category} className="flex items-center gap-2">
                    <span className="text-terminal-xs w-24 sm:w-28 truncate flex-shrink-0 text-foreground">
                      {cat.category}
                    </span>
                    <div className="flex-1 h-4 bg-terminal-bg rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: `${color}99` }}
                      />
                    </div>
                    <span className="text-terminal-xs tabular-nums flex-shrink-0 w-20 text-right text-foreground">
                      {formatCurrency(amt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top vendors */}
        {breakdown.vendors.length > 0 && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">Top Vendors</span>
            <FinanceTable
              columns={[
                { key: "vendor_name", label: "Vendor" },
                { key: "amount", label: "Amount", align: "right", format: formatCurrency },
              ]}
              rows={breakdown.vendors}
              highlightName=""
            />
          </div>
        )}
      </div>
    );
  }

  // Comparison mode — grouped bar chart by category
  // Pivot: each category as an x-axis entry, each candidate as a grouped bar
  const categories = [...new Set(allBreakdown.by_category.map((r: any) => r.category))];
  const candidateNames = [...new Set(allBreakdown.by_category.map((r: any) => r.name))];

  const chartData = categories.map((cat) => {
    const row: any = { category: cat };
    candidateNames.forEach((name) => {
      const entry = allBreakdown.by_category.find(
        (r: any) => r.category === cat && r.name === name
      );
      row[name] = entry ? parseFloat(entry.amount) : 0;
    });
    return row;
  });

  // Sort chart data by total descending
  chartData.sort((a, b) => {
    const totalA = candidateNames.reduce((sum, n) => sum + (a[n] || 0), 0);
    const totalB = candidateNames.reduce((sum, n) => sum + (b[n] || 0), 0);
    return totalB - totalA;
  });

  const barData = spending.map((s) => ({
    name: s.name,
    value: parseFloat(s.total_spending) || 0,
    party: s.party,
    candidateId: s.candidate_id,
  }));

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Total spending comparison */}
      <div className="bg-terminal-panel border border-border rounded p-3">
        <ComparisonBar
          data={barData}
          label="Total Spending"
          onSelect={onSelectCandidate}
        />
      </div>

      {/* Grouped bar chart by category */}
      {chartData.length > 0 && (
        <div className="bg-terminal-panel border border-border rounded p-3">
          <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
            Spending by Category
          </span>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="15%">
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 9, fill: "#727290" }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={40}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#727290" }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{ background: "#0f1117", border: "1px solid #262840", fontSize: 11 }}
                  formatter={(v: any, name?: string) => [formatCurrency(v), name ?? ""]}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                {candidateNames.map((name) => (
                  <Bar key={name} dataKey={name} fill={CANDIDATE_COLORS[name] || "#727290"} radius={[2, 2, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fillOpacity={name === "Graham Platner" ? 0.9 : 0.6} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Comparison table */}
      <FinanceTable
        columns={[
          { key: "name", label: "Candidate" },
          { key: "total_spending", label: "Spending", align: "right", format: formatCurrency },
          { key: "expenditure_count", label: "Expenditures", align: "right", format: formatNumber },
        ]}
        rows={spending}
        onRowClick={(row) => row.candidate_id && onSelectCandidate(row.candidate_id)}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "./metric-card";
import { ComparisonBar } from "./comparison-bar";
import { FinanceTable } from "./finance-table";
import { formatCurrency, formatPct, formatNumber } from "./format";
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

interface GeographyTabProps {
  candidateId: number | null;
  onSelectCandidate: (id: number) => void;
}

export function GeographyTab({ candidateId, onSelectCandidate }: GeographyTabProps) {
  const [geography, setGeography] = useState<any[]>([]);
  const [detail, setDetail] = useState<{ regions: any[]; cities: any[]; states: any[] }>({ regions: [], cities: [], states: [] });
  const [candidateData, setCandidateData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (candidateId) {
      Promise.all([
        fetch(`/api/finance/candidate/${candidateId}`).then((r) => r.json()),
        fetch(`/api/finance/geography-detail?candidate_id=${candidateId}`).then((r) => r.json()),
      ])
        .then(([cand, d]) => {
          setCandidateData(cand);
          setDetail(d);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      fetch("/api/finance/geography")
        .then((r) => r.json())
        .then(setGeography)
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
    const g = candidateData.geography;

    return (
      <div className="p-3 flex flex-col gap-3">
        <h3 className="text-terminal-sm text-terminal-dim tracking-wider uppercase">
          Geography — {candidateData.candidate.name}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricCard label="In-State" value={formatCurrency(g?.in_state_amount)} />
          <MetricCard label="Out-of-State" value={formatCurrency(g?.out_of_state_amount)} color="cyan" />
          <MetricCard label="In-State %" value={formatPct(g?.in_state_pct)} color="green" />
          <MetricCard label="Diversity Score" value={formatNumber(g?.diversity_score)} />
        </div>

        {/* Regional breakdown with bar chart */}
        {detail.regions.length > 0 && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">By Region</span>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={detail.regions.map((r: any) => ({ region: r.region, amount: parseFloat(r.amount) || 0 }))}
                  layout="vertical"
                  barSize={14}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#727290" }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  />
                  <YAxis
                    type="category"
                    dataKey="region"
                    tick={{ fontSize: 10, fill: "#727290" }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{ background: "#0f1117", border: "1px solid #262840", fontSize: 11 }}
                    formatter={(v: any) => [formatCurrency(v), "Amount"]}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="amount" radius={[0, 3, 3, 0]}>
                    {detail.regions.map((_: any, i: number) => (
                      <Cell key={i} fill={i === 0 ? "#FFD700" : "#4488FF"} fillOpacity={1 - i * 0.1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top cities */}
        {detail.cities.length > 0 && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">Top Cities</span>
            <FinanceTable
              columns={[
                { key: "city", label: "City" },
                { key: "amount", label: "Amount", align: "right", format: formatCurrency },
              ]}
              rows={detail.cities}
              highlightName=""
              maxRows={15}
            />
          </div>
        )}

        {/* Top states */}
        {detail.states.length > 0 && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">Top States</span>
            <FinanceTable
              columns={[
                { key: "state", label: "State" },
                { key: "amount", label: "Amount", align: "right", format: formatCurrency },
              ]}
              rows={detail.states}
              highlightName=""
            />
          </div>
        )}
      </div>
    );
  }

  // Comparison mode — horizontal bar chart showing in-state vs out-of-state %
  const geoChartData = geography.map((g) => ({
    name: g.name,
    party: g.party,
    inState: parseFloat(g.in_state_pct) || 0,
    outOfState: 100 - (parseFloat(g.in_state_pct) || 0),
    candidateId: g.candidate_id,
  }));

  // Sort by in-state % descending
  geoChartData.sort((a, b) => b.inState - a.inState);

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* In-State vs Out-of-State stacked horizontal bar */}
      <div className="bg-terminal-panel border border-border rounded p-3">
        <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
          In-State vs Out-of-State Fundraising
        </span>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={geoChartData} layout="vertical" barSize={16}>
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#727290" }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: "#727290" }}
                width={110}
              />
              <Tooltip
                contentStyle={{ background: "#0f1117", border: "1px solid #262840", fontSize: 11 }}
                formatter={(v: any, name?: string) => [`${Number(v).toFixed(1)}%`, name === "inState" ? "In-State" : "Out-of-State"]}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="inState" stackId="a" fill="#51cf66" fillOpacity={0.7} radius={[0, 0, 0, 0]} name="inState" />
              <Bar dataKey="outOfState" stackId="a" fill="#4488FF" fillOpacity={0.5} radius={[0, 3, 3, 0]} name="outOfState" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-2 text-terminal-xs text-terminal-dim">
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm bg-[#51cf66]/70 inline-block" /> In-State
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm bg-[#4488FF]/50 inline-block" /> Out-of-State
          </span>
        </div>
      </div>

      {/* Comparison table */}
      <FinanceTable
        columns={[
          { key: "name", label: "Candidate" },
          { key: "in_state_amount", label: "In-State", align: "right", format: formatCurrency },
          { key: "out_of_state_amount", label: "Out-of-State", align: "right", format: formatCurrency },
          { key: "in_state_pct", label: "In-State %", align: "right", format: formatPct },
          { key: "diversity_score", label: "Diversity", align: "right", format: formatNumber },
        ]}
        rows={geography}
        onRowClick={(row) => row.candidate_id && onSelectCandidate(row.candidate_id)}
      />
    </div>
  );
}

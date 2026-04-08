"use client";

import { useEffect, useState } from "react";
import { FinanceTable } from "./finance-table";
import { formatCurrency } from "./format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface FilingsTabProps {
  candidateId: number | null;
  onSelectCandidate: (id: number) => void;
}

export function FilingsTab({ candidateId, onSelectCandidate }: FilingsTabProps) {
  const [filings, setFilings] = useState<any[]>([]);
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
      fetch("/api/finance/filings")
        .then((r) => r.json())
        .then(setFilings)
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

  // Candidate mode
  if (candidateId && candidateData) {
    const f = candidateData.filings || [];
    // Build cash on hand trend from filings
    const cohTrend = f
      .filter((r: any) => r.cash_on_hand != null)
      .sort((a: any, b: any) => (a.thru_date || "").localeCompare(b.thru_date || ""))
      .map((r: any) => ({
        date: r.thru_date,
        cash: parseFloat(r.cash_on_hand) || 0,
      }));

    return (
      <div className="p-3 flex flex-col gap-3">
        <h3 className="text-terminal-sm text-terminal-dim tracking-wider uppercase">
          Filings — {candidateData.candidate.name}
        </h3>

        {/* Cash on hand trend */}
        {cohTrend.length > 1 && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">Cash on Hand Trend</span>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cohTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#727290" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#727290" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ background: "#0f1117", border: "1px solid #262840", fontSize: 11 }}
                    formatter={(v) => [formatCurrency(v as number), "Cash on Hand"]}
                  />
                  <Line type="monotone" dataKey="cash" stroke="#FFD700" strokeWidth={1.5} dot={{ r: 2, fill: "#FFD700" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <FinanceTable
          columns={[
            { key: "form_type", label: "Form" },
            { key: "thru_date", label: "Through" },
            { key: "rpt_date", label: "Filed" },
            { key: "cash_on_hand", label: "Cash", align: "right", format: formatCurrency },
            { key: "receipts", label: "Receipts", align: "right", format: formatCurrency },
            { key: "expenditures", label: "Spent", align: "right", format: formatCurrency },
          ]}
          rows={f}
          highlightName=""
        />
      </div>
    );
  }

  // All mode
  return (
    <div className="p-3 flex flex-col gap-3">
      <FinanceTable
        columns={[
          { key: "name", label: "Candidate" },
          { key: "form_type", label: "Form" },
          { key: "thru_date", label: "Through" },
          { key: "rpt_date", label: "Filed" },
          { key: "cash_on_hand", label: "Cash", align: "right", format: formatCurrency },
          { key: "receipts", label: "Receipts", align: "right", format: formatCurrency },
          { key: "expenditures", label: "Spent", align: "right", format: formatCurrency },
        ]}
        rows={filings}
        onRowClick={(row) => row.candidate_id && onSelectCandidate(row.candidate_id)}
      />
    </div>
  );
}

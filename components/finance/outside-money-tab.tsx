"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "./metric-card";
import { ComparisonBar } from "./comparison-bar";
import { FinanceTable } from "./finance-table";
import { formatCurrency, formatNumber } from "./format";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface OutsideMoneyTabProps {
  candidateId: number | null;
  onSelectCandidate: (id: number) => void;
}

export function OutsideMoneyTab({ candidateId, onSelectCandidate }: OutsideMoneyTabProps) {
  const [summary, setSummary] = useState<any[]>([]);
  const [committees, setCommittees] = useState<any[]>([]);
  const [expenditures, setExpenditures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = candidateId
      ? `/api/finance/independent-expenditures?candidate_id=${candidateId}`
      : "/api/finance/independent-expenditures";

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setSummary(data.summary || []);
        setCommittees(data.committees || []);
        setExpenditures(data.expenditures || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [candidateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-terminal-yellow glow-yellow animate-pulse">Loading...</span>
      </div>
    );
  }

  if (summary.length === 0) {
    return (
      <div className="text-center py-12 text-terminal-dim text-terminal-sm">
        No independent expenditure data available
      </div>
    );
  }

  // Drill-down: single candidate
  if (candidateId && summary.length === 1) {
    const s = summary[0];
    const support = parseFloat(s.total_support) || 0;
    const oppose = parseFloat(s.total_oppose) || 0;
    const net = parseFloat(s.net_support) || 0;
    const maxComm = Math.max(...committees.map((c) => parseFloat(c.total) || 0), 1);

    return (
      <div className="p-3 flex flex-col gap-3">
        <h3 className="text-terminal-sm text-terminal-dim tracking-wider uppercase">
          Outside Money — {s.name}
        </h3>

        <div className="grid grid-cols-3 gap-2">
          <MetricCard label="Support" value={formatCurrency(support)} color="green" />
          <MetricCard label="Oppose" value={formatCurrency(oppose)} color="red" />
          <MetricCard
            label="Net"
            value={formatCurrency(net)}
            color={net >= 0 ? "green" : "red"}
            subtitle={`${s.committee_count} committees`}
          />
        </div>

        {/* Support vs Oppose bar */}
        {(support > 0 || oppose > 0) && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
              Support vs Opposition
            </span>
            <div className="flex gap-1 h-6 rounded overflow-hidden">
              {support > 0 && (
                <div
                  className="bg-green-500/60 rounded-l flex items-center justify-center text-[10px] text-white/80 transition-all"
                  style={{ width: `${(support / (support + oppose)) * 100}%` }}
                >
                  {Math.round((support / (support + oppose)) * 100)}% FOR
                </div>
              )}
              {oppose > 0 && (
                <div
                  className="bg-red-500/60 rounded-r flex items-center justify-center text-[10px] text-white/80 transition-all"
                  style={{ width: `${(oppose / (support + oppose)) * 100}%` }}
                >
                  {Math.round((oppose / (support + oppose)) * 100)}% AGAINST
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top committees */}
        {committees.length > 0 && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
              Top PAC/IE Committees
            </span>
            <div className="flex flex-col gap-1">
              {committees.slice(0, 15).map((c: any, i: number) => {
                const total = parseFloat(c.total) || 0;
                const sup = parseFloat(c.support) || 0;
                const opp = parseFloat(c.oppose) || 0;
                const pct = (total / maxComm) * 100;
                const barColor = opp > sup ? "bg-red-500/50" : "bg-green-500/50";

                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-terminal-xs w-48 sm:w-64 truncate flex-shrink-0 text-foreground" title={c.committee_name}>
                      {c.committee_name}
                    </span>
                    <div className="flex-1 h-4 bg-terminal-bg rounded overflow-hidden">
                      <div
                        className={`h-full rounded transition-all ${barColor}`}
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                    <span className={`text-terminal-xs tabular-nums flex-shrink-0 w-20 text-right ${opp > sup ? "text-terminal-red" : "text-green-400"}`}>
                      {formatCurrency(total)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent expenditures table */}
        {expenditures.length > 0 && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
              Expenditure Records
            </span>
            <FinanceTable
              columns={[
                { key: "committee_name", label: "Committee" },
                { key: "support_oppose", label: "S/O", format: (v: any) => v === "S" ? "FOR" : "AGAINST" },
                { key: "amount", label: "Amount", align: "right", format: formatCurrency },
                { key: "date", label: "Date" },
              ]}
              rows={expenditures}
              highlightName=""
            />
          </div>
        )}
      </div>
    );
  }

  // Comparison mode — all candidates
  const totalOutside = summary.reduce((s, r) => s + (parseFloat(r.total_support) || 0) + (parseFloat(r.total_oppose) || 0), 0);
  const totalSupport = summary.reduce((s, r) => s + (parseFloat(r.total_support) || 0), 0);
  const totalOppose = summary.reduce((s, r) => s + (parseFloat(r.total_oppose) || 0), 0);
  const totalCommittees = summary.reduce((s, r) => s + (parseInt(r.committee_count) || 0), 0);

  // Bar chart data: support + oppose combined
  const supportData = summary.map((s) => ({
    name: s.name,
    value: parseFloat(s.total_support) || 0,
    party: s.party,
    candidateId: s.candidate_id,
  }));

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Top-line metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Total Outside $" value={formatCurrency(totalOutside)} />
        <MetricCard label="Support" value={formatCurrency(totalSupport)} color="green" />
        <MetricCard label="Oppose" value={formatCurrency(totalOppose)} color="red" />
        <MetricCard label="Committees" value={formatNumber(totalCommittees)} color="cyan" />
      </div>

      {/* Support comparison bar */}
      <div className="bg-terminal-panel border border-border rounded p-3">
        <ComparisonBar
          data={supportData}
          label="IE Support by Candidate"
          onSelect={onSelectCandidate}
        />
      </div>

      {/* Support vs Oppose table */}
      <div className="bg-terminal-panel border border-border rounded p-3">
        <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
          Outside Money Breakdown
        </span>
        <div className="overflow-x-auto">
          <table className="w-full text-terminal-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase text-left">Candidate</th>
                <th className="px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase text-left w-8">Pty</th>
                <th className="px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase text-right">Support</th>
                <th className="px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase text-right">Oppose</th>
                <th className="px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase text-right">Net</th>
                <th className="px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase text-right">PACs</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row, i) => {
                const support = parseFloat(row.total_support) || 0;
                const oppose = parseFloat(row.total_oppose) || 0;
                const net = parseFloat(row.net_support) || 0;
                const isHighlight = row.name === "Graham Platner";

                return (
                  <tr
                    key={i}
                    onClick={() => row.candidate_id && onSelectCandidate(row.candidate_id)}
                    className={`border-b border-border/50 cursor-pointer hover:bg-terminal-raised/50 transition-colors ${
                      isHighlight ? "bg-terminal-yellow/5" : ""
                    }`}
                  >
                    <td className={`px-2 py-1.5 ${isHighlight ? "text-terminal-yellow" : ""}`}>
                      {row.name}
                    </td>
                    <td className={`px-2 py-1.5 w-8 ${row.party === "R" ? "text-red-400" : "text-blue-400"}`}>
                      {row.party}
                    </td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${support > 0 ? "text-green-400" : "text-terminal-dim"}`}>
                      {formatCurrency(support)}
                    </td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${oppose > 0 ? "text-terminal-red" : "text-terminal-dim"}`}>
                      {formatCurrency(oppose)}
                    </td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${net >= 0 ? "text-green-400" : "text-terminal-red"}`}>
                      {formatCurrency(net)}
                    </td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${isHighlight ? "text-terminal-yellow" : ""}`}>
                      {row.committee_count}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top committees across all candidates */}
      {committees.length > 0 && (
        <div className="bg-terminal-panel border border-border rounded p-3">
          <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
            Top PAC/IE Committees
          </span>
          <FinanceTable
            columns={[
              { key: "candidate_name", label: "Candidate" },
              { key: "committee_name", label: "Committee" },
              { key: "support", label: "Support", align: "right", format: formatCurrency },
              { key: "oppose", label: "Oppose", align: "right", format: formatCurrency },
              { key: "total", label: "Total", align: "right", format: formatCurrency },
            ]}
            rows={committees.slice(0, 20)}
            onRowClick={(row) => row.candidate_id && onSelectCandidate(row.candidate_id)}
          />
        </div>
      )}

      <div className="text-terminal-xs text-terminal-dim px-1">
        <span className="text-green-400">Green</span> = support (FOR candidate)
        {" · "}
        <span className="text-terminal-red">Red</span> = oppose (AGAINST candidate)
        {" · "}
        Source: CalAccess Form 496
      </div>
    </div>
  );
}

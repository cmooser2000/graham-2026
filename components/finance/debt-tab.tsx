"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "./metric-card";
import { FinanceTable } from "./finance-table";
import { formatCurrency } from "./format";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DebtTabProps {
  candidateId: number | null;
  onSelectCandidate: (id: number) => void;
}

export function DebtTab({ candidateId, onSelectCandidate }: DebtTabProps) {
  const [debtData, setDebtData] = useState<{ summary: any[]; creditors: any[]; lenders: any[] }>({ summary: [], creditors: [], lenders: [] });
  const [candidateData, setCandidateData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (candidateId) {
      Promise.all([
        fetch(`/api/finance/candidate/${candidateId}`).then((r) => r.json()),
        fetch(`/api/finance/debts?candidate_id=${candidateId}`).then((r) => r.json()),
      ])
        .then(([cand, d]) => {
          setCandidateData(cand);
          setDebtData(d);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      fetch("/api/finance/debts")
        .then((r) => r.json())
        .then(setDebtData)
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
    const d = candidateData.debts;
    const selfLoanAmt = parseFloat(d?.self_loans) || 0;

    return (
      <div className="p-3 flex flex-col gap-3">
        <h3 className="text-terminal-sm text-terminal-dim tracking-wider uppercase">
          Debt — {candidateData.candidate.name}
        </h3>

        <div className="grid grid-cols-3 gap-2">
          <MetricCard label="Total Debt" value={formatCurrency(d?.total_debt)} color="red" />
          <MetricCard label="Total Loans" value={formatCurrency(d?.total_loans)} />
          <MetricCard label="Self-Loans" value={formatCurrency(d?.self_loans)} color="cyan" />
        </div>

        {/* Self-loan prominence */}
        {selfLoanAmt > 0 && (
          <div className="bg-terminal-panel border border-terminal-cyan/30 rounded p-3 text-center">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-1">
              Self-Funded
            </span>
            <span className="text-terminal-xl font-semibold text-terminal-cyan glow-cyan">
              {formatCurrency(selfLoanAmt)}
            </span>
            <span className="text-terminal-xs text-terminal-dim block mt-1">
              in personal loans to campaign
            </span>
          </div>
        )}

        {debtData.creditors.length > 0 && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">Top Creditors</span>
            <FinanceTable
              columns={[
                { key: "name", label: "Creditor" },
                { key: "amount", label: "Amount", align: "right", format: formatCurrency },
              ]}
              rows={debtData.creditors}
              highlightName=""
            />
          </div>
        )}

        {debtData.lenders.length > 0 && (
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">Top Lenders</span>
            <FinanceTable
              columns={[
                { key: "name", label: "Lender" },
                { key: "amount", label: "Amount", align: "right", format: formatCurrency },
              ]}
              rows={debtData.lenders}
              highlightName=""
            />
          </div>
        )}
      </div>
    );
  }

  // Comparison mode — table with color-coded debt-to-cash ratios
  const withDebt = debtData.summary.filter((d) => parseFloat(d.total_debt) > 0 || parseFloat(d.total_loans) > 0);

  // Enhanced table rows with debt-to-cash ratio color coding
  const enhancedRows = debtData.summary.map((row) => {
    const debt = parseFloat(row.total_debt) || 0;
    const cash = parseFloat(row.cash_on_hand) || 1; // avoid /0
    const ratio = debt / cash;
    return { ...row, _debtRatio: ratio, _highDebt: ratio > 0.5 };
  });

  return (
    <div className="p-3 flex flex-col gap-3">
      {withDebt.length === 0 ? (
        <div className="text-center py-6 text-terminal-dim text-terminal-sm">
          No candidates have reported debt
        </div>
      ) : (
        <>
          <div className="bg-terminal-panel border border-border rounded p-3">
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
              Debt Overview
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-terminal-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase text-left">Candidate</th>
                    <th className="px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase text-left w-8">Pty</th>
                    <th className="px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase text-right">Debt</th>
                    <th className="px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase text-right">Loans</th>
                    <th className="px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase text-right">Self-Loans</th>
                  </tr>
                </thead>
                <tbody>
                  {enhancedRows.map((row, i) => {
                    const debt = parseFloat(row.total_debt) || 0;
                    const loans = parseFloat(row.total_loans) || 0;
                    const selfLoans = parseFloat(row.self_loans) || 0;
                    const isHighlight = row.name === "Graham Platner";
                    const isHighDebt = row._highDebt && debt > 0;

                    if (debt === 0 && loans === 0) return null;

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
                        <td className={`px-2 py-1.5 w-8 ${isHighlight ? "text-terminal-yellow" : ""}`}>
                          {row.party}
                        </td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${
                          isHighDebt ? "text-terminal-red glow-red" : isHighlight ? "text-terminal-yellow" : ""
                        }`}>
                          {formatCurrency(debt)}
                        </td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${isHighlight ? "text-terminal-yellow" : ""}`}>
                          {formatCurrency(loans)}
                        </td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${
                          selfLoans > 0 ? "text-terminal-cyan" : isHighlight ? "text-terminal-yellow" : ""
                        }`}>
                          {formatCurrency(selfLoans)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-terminal-xs text-terminal-dim px-1">
            <span className="text-terminal-red">Red</span> = debt-to-cash ratio &gt; 50%
            {" · "}
            <span className="text-terminal-cyan">Cyan</span> = self-funded loans
          </div>
        </>
      )}
    </div>
  );
}

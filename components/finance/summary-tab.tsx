"use client";

import { useEffect, useState, useMemo } from "react";
import { formatCurrency, formatPct, formatNumber } from "./format";

interface CandidateRow {
  candidate_id: number;
  name: string;
  party: string;
  has_form_460: boolean;
  cash_on_hand: string | null;
  total_receipts: string | null;
  total_expenditures: string | null;
  burn_rate: string | null;
  runway_months: string | null;
  s497_total_raised: string | null;
  contrib_total_raised: string | null;
  unique_donors: string | null;
  avg_contribution: string | null;
  repeat_donor_rate: string | null;
  in_state_pct: string | null;
  diversity_score: string | null;
}

interface SummaryTabProps {
  candidateId: number | null;
  onSelectCandidate: (id: number) => void;
}

type SortKey =
  | "name"
  | "cash_on_hand"
  | "total_receipts"
  | "total_expenditures"
  | "burn_rate"
  | "unique_donors"
  | "avg_contribution"
  | "in_state_pct";

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

function getField(row: CandidateRow, key: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (row as any)[key];
}

export function SummaryTab({ candidateId, onSelectCandidate }: SummaryTabProps) {
  const [data, setData] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("total_receipts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setLoading(true);
    fetch("/api/finance/summary")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortKey === "name") {
        return sortDir === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      const av = num(getField(a, sortKey));
      const bv = num(getField(b, sortKey));
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [data, sortKey, sortDir]);

  // Compute column maxes for proportional bars
  const maxes = useMemo(() => {
    const keys = [
      "cash_on_hand",
      "total_receipts",
      "total_expenditures",
      "burn_rate",
      "unique_donors",
      "avg_contribution",
      "in_state_pct",
    ] as const;
    const result: Record<string, number> = {};
    for (const k of keys) {
      result[k] = Math.max(
        ...data.map((d) => num(getField(d, k))),
        1
      );
    }
    return result;
  }, [data]);

  // Insight cards
  const insights = useMemo(() => {
    if (data.length === 0) return null;

    const bestCOH = [...data].sort(
      (a, b) => num(b.cash_on_hand) + num(b.s497_total_raised) - (num(a.cash_on_hand) + num(a.s497_total_raised))
    )[0];
    const mostDonors = [...data].sort(
      (a, b) => num(b.unique_donors) - num(a.unique_donors)
    )[0];
    const highestBurn = [...data]
      .filter((d) => num(d.burn_rate) > 0)
      .sort((a, b) => num(b.burn_rate) - num(a.burn_rate))[0];
    const mostInState = [...data]
      .filter((d) => num(d.in_state_pct) > 0)
      .sort((a, b) => num(b.in_state_pct) - num(a.in_state_pct))[0];

    return { bestCOH, mostDonors, highestBurn, mostInState };
  }, [data]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-terminal-yellow glow-yellow animate-pulse">
          Loading...
        </span>
      </div>
    );
  }

  const lastName = (name: string) => name.split(" ").pop() || name;

  const columns: {
    key: SortKey;
    label: string;
    format: (v: unknown) => string;
    showBar?: boolean;
  }[] = [
    { key: "name", label: "Candidate", format: (v) => String(v) },
    { key: "cash_on_hand", label: "Cash / S497", format: (v) => formatCurrency(v as number), showBar: true },
    { key: "total_receipts", label: "Raised", format: (v) => formatCurrency(v as number), showBar: true },
    { key: "total_expenditures", label: "Spent", format: (v) => formatCurrency(v as number), showBar: true },
    { key: "burn_rate", label: "Burn %", format: (v) => formatPct(v as number), showBar: true },
    { key: "unique_donors", label: "Donors", format: (v) => num(v as number) > 0 ? formatNumber(v as number) : "—", showBar: true },
    { key: "avg_contribution", label: "Avg $", format: (v) => num(v as number) > 0 ? formatCurrency(v as number) : "—", showBar: true },
    { key: "in_state_pct", label: "In-State", format: (v) => formatPct(v as number), showBar: true },
  ];

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Insight cards */}
      {insights && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <InsightCard
            label="Leader by COH"
            name={lastName(insights.bestCOH.name)}
            value={formatCurrency(
              num(insights.bestCOH.cash_on_hand) +
                num(insights.bestCOH.s497_total_raised)
            )}
            color="yellow"
          />
          {insights.mostDonors && num(insights.mostDonors.unique_donors) > 0 && (
            <InsightCard
              label="Most Donors"
              name={lastName(insights.mostDonors.name)}
              value={formatNumber(insights.mostDonors.unique_donors)}
              color="cyan"
            />
          )}
          {insights.highestBurn && (
            <InsightCard
              label="Highest Burn"
              name={lastName(insights.highestBurn.name)}
              value={formatPct(insights.highestBurn.burn_rate)}
              color="red"
            />
          )}
          {insights.mostInState && (
            <InsightCard
              label="Most In-State"
              name={lastName(insights.mostInState.name)}
              value={formatPct(insights.mostInState.in_state_pct)}
              color="green"
            />
          )}
        </div>
      )}

      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full text-terminal-xs">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap ${
                    col.key === "name" ? "text-left" : "text-right"
                  }`}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-0.5 text-terminal-yellow">
                      {sortDir === "asc" ? "\u2191" : "\u2193"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isSelected = candidateId === row.candidate_id;
              const isSwalwell = row.name === "Graham Platner";
              // For the cash column, show COH if available, else S497
              const cashValue =
                num(row.cash_on_hand) > 0
                  ? num(row.cash_on_hand)
                  : num(row.s497_total_raised);

              return (
                <tr
                  key={row.candidate_id}
                  onClick={() => onSelectCandidate(row.candidate_id)}
                  className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-terminal-raised/50 ${
                    isSelected
                      ? "bg-terminal-yellow/8 border-l-2 border-l-terminal-yellow"
                      : ""
                  }`}
                >
                  {columns.map((col) => {
                    const isName = col.key === "name";

                    if (isName) {
                      return (
                        <td
                          key={col.key}
                          className={`px-2 py-1.5 whitespace-nowrap ${
                            isSwalwell ? "text-terminal-yellow" : ""
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`text-[9px] font-semibold ${
                                row.party === "R"
                                  ? "text-red-400"
                                  : "text-blue-400"
                              }`}
                            >
                              {row.party}
                            </span>
                            <span>{row.name}</span>
                            {!row.has_form_460 && (
                              <span className="text-[8px] text-terminal-muted border border-terminal-muted/40 rounded px-1 leading-tight">
                                S497
                              </span>
                            )}
                          </span>
                        </td>
                      );
                    }

                    // Numeric columns with proportional bars
                    const rawVal =
                      col.key === "cash_on_hand"
                        ? cashValue
                        : num(getField(row, col.key));
                    const maxVal =
                      col.key === "cash_on_hand"
                        ? Math.max(
                            ...data.map(
                              (d) =>
                                Math.max(
                                  num(d.cash_on_hand),
                                  num(d.s497_total_raised)
                                )
                            ),
                            1
                          )
                        : maxes[col.key] || 1;
                    const pct = maxVal > 0 ? (rawVal / maxVal) * 100 : 0;

                    const barColor = isSwalwell
                      ? "bg-terminal-yellow/30"
                      : row.party === "R"
                      ? "bg-red-500/20"
                      : "bg-terminal-blue/20";

                    return (
                      <td
                        key={col.key}
                        className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${
                          isSwalwell ? "text-terminal-yellow" : ""
                        }`}
                      >
                        <div className="relative flex items-center justify-end">
                          {col.showBar && (
                            <div
                              className={`absolute inset-y-0 right-0 rounded-sm ${barColor}`}
                              style={{
                                width: `${Math.max(pct, 0)}%`,
                              }}
                            />
                          )}
                          <span className="relative z-10">
                            {col.key === "cash_on_hand"
                              ? formatCurrency(cashValue)
                              : col.format(rawVal)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-6 text-terminal-dim text-terminal-sm">
            No data available
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[9px] text-terminal-muted px-1">
        <span>
          <span className="inline-block w-2 h-2 rounded-sm bg-terminal-yellow/30 mr-1 align-middle" />
          Platner
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-sm bg-terminal-blue/20 mr-1 align-middle" />
          Democrat
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-sm bg-red-500/20 mr-1 align-middle" />
          Republican
        </span>
        <span>
          <span className="border border-terminal-muted/40 rounded px-1 mr-1 align-middle">
            S497
          </span>
          No Form 460
        </span>
      </div>
    </div>
  );
}

function InsightCard({
  label,
  name,
  value,
  color,
}: {
  label: string;
  name: string;
  value: string;
  color: "yellow" | "green" | "cyan" | "red";
}) {
  const colorMap = {
    yellow: "text-terminal-yellow glow-yellow",
    green: "text-green-400",
    cyan: "text-terminal-cyan glow-cyan",
    red: "text-terminal-red glow-red",
  };

  return (
    <div className="bg-terminal-panel border border-border rounded px-3 py-2.5 min-w-0">
      <span className="text-[9px] text-terminal-dim tracking-wider uppercase block truncate">
        {label}
      </span>
      <span
        className={`text-terminal-lg font-semibold tabular-nums block mt-0.5 truncate ${colorMap[color]}`}
      >
        {value}
      </span>
      <span className="text-terminal-xs text-terminal-muted block truncate">
        {name}
      </span>
    </div>
  );
}

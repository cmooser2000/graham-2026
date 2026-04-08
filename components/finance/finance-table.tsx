"use client";

import { useState, useMemo } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Column {
  key: string;
  label: string;
  format?: (v: any) => string;
  align?: "left" | "right";
  className?: string;
}

interface FinanceTableProps {
  columns: Column[];
  rows: Record<string, any>[];
  onRowClick?: (row: Record<string, any>) => void;
  highlightName?: string;
  maxRows?: number;
}

export function FinanceTable({ columns, rows, onRowClick, highlightName = "Graham Platner", maxRows }: FinanceTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const data = maxRows ? rows.slice(0, maxRows) : rows;
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const na = typeof av === "string" ? parseFloat(av) : av;
      const nb = typeof bv === "string" ? parseFloat(bv) : bv;
      if (!isNaN(na) && !isNaN(nb)) {
        return sortDir === "asc" ? na - nb : nb - na;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [rows, sortKey, sortDir, maxRows]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-terminal-xs">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`px-2 py-1.5 font-medium text-terminal-dim tracking-wider uppercase cursor-pointer hover:text-foreground transition-colors select-none ${
                  col.align === "right" ? "text-right" : "text-left"
                } ${col.className || ""}`}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-0.5 text-terminal-yellow">{sortDir === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const isHighlight = highlightName && (row.name === highlightName || row.candidate_name === highlightName);
            return (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-border/50 transition-colors ${
                  onRowClick ? "cursor-pointer hover:bg-terminal-raised/50" : ""
                } ${isHighlight ? "bg-terminal-yellow/5" : ""}`}
              >
                {columns.map((col) => {
                  const val = row[col.key];
                  const display = col.format ? col.format(val) : val;
                  return (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 tabular-nums ${
                        col.align === "right" ? "text-right" : "text-left"
                      } ${isHighlight ? "text-terminal-yellow" : ""} ${col.className || ""}`}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="text-center py-6 text-terminal-dim text-terminal-sm">No data available</div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColumnDef, DataRow } from "@/lib/data/types";
import { ChevronUp, ChevronDown } from "lucide-react";

interface DataTableProps {
  columns: ColumnDef[];
  rows: DataRow[];
  onRowClick: (row: DataRow) => void;
  sort: { key: string; direction: "asc" | "desc" } | undefined;
  onSort: (key: string) => void;
}

function formatCell(value: unknown, type: ColumnDef["type"]): string {
  if (value === null || value === undefined) return "-";
  switch (type) {
    case "currency":
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value));
    case "date":
      return value instanceof Date ? value.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : String(value);
    case "boolean":
      return value ? "YES" : "NO";
    case "number":
      return Number(value).toLocaleString();
    default:
      return String(value);
  }
}

export function DataTable({ columns, rows, onRowClick, sort, onSort }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={`text-terminal-xs text-terminal-blue font-medium tracking-wider uppercase whitespace-nowrap cursor-pointer select-none py-2 px-2 ${
                  col.align === "right" ? "text-right" : ""
                }`}
                onClick={() => col.sortable && onSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sort?.key === col.key && (
                    sort.direction === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                  )}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              className={`border-border cursor-pointer transition-colors hover:bg-terminal-raised ${
                i % 2 === 0 ? "bg-terminal-panel" : "bg-terminal-bg"
              }`}
              onClick={() => onRowClick(row)}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={`text-terminal-sm py-1.5 px-2 whitespace-nowrap tabular-nums ${
                    col.align === "right" ? "text-right" : ""
                  } ${
                    col.type === "currency" ? "text-terminal-yellow" : ""
                  } ${
                    col.type === "boolean" && row[col.key] ? "text-terminal-red font-medium" : ""
                  }`}
                >
                  {formatCell(row[col.key], col.type)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

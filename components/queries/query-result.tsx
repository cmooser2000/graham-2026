"use client";

import { useState } from "react";
import { QueryEntry } from "./queries-view";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface QueryResultProps {
  entry: QueryEntry;
  loading?: boolean;
  streaming?: boolean;
}

function formatCell(val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "number") {
    if (Math.abs(val) >= 1000) return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return String(val);
  }
  return String(val);
}

function NarrativeText({ text, streaming }: { text: string; streaming: boolean }) {
  // Simple markdown bold rendering: **text** → <strong>text</strong>
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="text-terminal-cyan">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
      {streaming && <span className="inline-block w-1.5 h-3.5 bg-terminal-green ml-0.5 animate-pulse" />}
    </span>
  );
}

export function QueryResultView({ entry, loading, streaming }: QueryResultProps) {
  const [dataOpen, setDataOpen] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);

  if (entry.error) {
    return (
      <div className="bg-terminal-panel border border-terminal-red/30 rounded p-3">
        <div className="text-terminal-xs text-terminal-red font-medium mb-1">ERROR</div>
        <div className="text-terminal-sm text-terminal-red">{entry.error}</div>
        {entry.sql && (
          <pre className="text-terminal-xs text-terminal-muted mt-2 whitespace-pre-wrap">{entry.sql}</pre>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Question */}
      <div className="text-terminal-sm text-terminal-cyan">{entry.question}</div>

      {/* Loading state (waiting for SQL + data) */}
      {loading && (
        <div className="flex items-center gap-2 text-terminal-sm text-terminal-dim py-2">
          <Loader2 size={14} className="animate-spin" />
          <span>Generating query...</span>
        </div>
      )}

      {/* Narrative answer */}
      {(entry.narrative || streaming) && (
        <div className="text-terminal-sm leading-relaxed">
          <NarrativeText text={entry.narrative} streaming={!!streaming} />
        </div>
      )}

      {/* Collapsible data section */}
      {entry.columns.length > 0 && (
        <div className="border border-border rounded">
          <button
            onClick={() => setDataOpen(!dataOpen)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-terminal-raised transition-colors text-left"
          >
            {dataOpen ? <ChevronDown size={12} className="text-terminal-dim" /> : <ChevronRight size={12} className="text-terminal-dim" />}
            <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase">Data</span>
            <span className="text-terminal-xs text-terminal-muted ml-auto">{entry.rowCount} row{entry.rowCount !== 1 ? "s" : ""}</span>
          </button>

          {dataOpen && (
            <div className="border-t border-border">
              {/* SQL subsection */}
              <button
                onClick={() => setSqlOpen(!sqlOpen)}
                className="w-full flex items-center gap-1.5 px-3 py-1 hover:bg-terminal-raised transition-colors text-left border-b border-border/50"
              >
                {sqlOpen ? <ChevronDown size={10} className="text-terminal-dim" /> : <ChevronRight size={10} className="text-terminal-dim" />}
                <span className="text-terminal-xs text-terminal-dim">SQL</span>
              </button>
              {sqlOpen && (
                <div className="px-3 py-2 border-b border-border/50 bg-terminal-raised">
                  <pre className="text-terminal-xs text-terminal-yellow whitespace-pre-wrap overflow-x-auto">{entry.sql}</pre>
                </div>
              )}

              {/* Data table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {entry.columns.map(col => (
                        <th key={col} className="text-terminal-xs text-terminal-blue font-medium tracking-wider uppercase text-left px-2 py-1.5 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entry.rows.slice(0, 50).map((row, i) => (
                      <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-terminal-panel" : "bg-terminal-bg"}`}>
                        {entry.columns.map(col => (
                          <td key={col} className="text-terminal-sm px-2 py-1 whitespace-nowrap tabular-nums">
                            {formatCell(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {entry.rowCount > 50 && (
                <div className="text-terminal-xs text-terminal-muted px-3 py-1">Showing 50 of {entry.rowCount} rows</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

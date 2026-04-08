"use client";

import { QueryEntry } from "./queries-view";
import { Clock } from "lucide-react";

interface QueryHistoryProps {
  entries: QueryEntry[];
  onSelect: (entry: QueryEntry) => void;
}

function getPreview(entry: QueryEntry): string {
  if (entry.error) return "error";
  if (entry.narrative) {
    // Strip markdown bold markers and truncate
    const clean = entry.narrative.replace(/\*\*/g, "");
    return clean.length > 80 ? clean.slice(0, 80) + "..." : clean;
  }
  return `${entry.rowCount} rows`;
}

export function QueryHistory({ entries, onSelect }: QueryHistoryProps) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        <Clock size={10} className="text-terminal-dim" />
        <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase">History</span>
      </div>
      <div className="flex flex-col gap-1">
        {entries.map((entry, i) => (
          <button
            key={i}
            onClick={() => onSelect(entry)}
            className="text-left bg-terminal-panel border border-border rounded px-3 py-1.5 hover:bg-terminal-raised transition-colors"
          >
            <span className="text-terminal-xs text-terminal-cyan line-clamp-1">{entry.question}</span>
            <span className="text-terminal-xs text-terminal-dim line-clamp-1">
              {getPreview(entry)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

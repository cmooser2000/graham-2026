"use client";

import { useEffect, useState } from "react";

interface Candidate {
  id: number;
  name: string;
  party: string;
}

interface CandidatePillsProps {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export function CandidatePills({ selectedId, onSelect }: CandidatePillsProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    fetch("/api/candidates")
      .then((r) => r.json())
      .then((data: Candidate[]) => setCandidates(data))
      .catch(() => {});
  }, []);

  const lastName = (name: string) => name.split(" ").pop() || name;

  return (
    <div className="flex gap-1.5 px-3 pt-3 pb-1 overflow-x-auto">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded text-terminal-sm whitespace-nowrap transition-colors flex-shrink-0 ${
          selectedId === null
            ? "bg-terminal-raised text-terminal-yellow border border-terminal-yellow/30"
            : "bg-terminal-panel text-terminal-dim border border-border hover:text-foreground"
        }`}
      >
        All
      </button>
      {candidates.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`px-2.5 py-1.5 rounded text-terminal-sm whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1 ${
            selectedId === c.id
              ? "bg-terminal-raised text-terminal-yellow border border-terminal-yellow/30"
              : "bg-terminal-panel text-terminal-dim border border-border hover:text-foreground"
          }`}
        >
          <span
            className={`text-[9px] font-semibold ${
              c.party === "R" ? "text-red-400" : "text-blue-400"
            }`}
          >
            {c.party}
          </span>
          {lastName(c.name)}
        </button>
      ))}
    </div>
  );
}

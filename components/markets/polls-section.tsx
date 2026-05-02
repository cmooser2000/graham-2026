"use client";

import { useState, useEffect } from "react";

interface PollResult {
  candidate_name: string;
  percentage: number;
  matched_name?: string;
  matched_party?: string;
  party?: string;
}

interface Poll {
  id: number;
  pollster: string;
  start_date: string;
  end_date: string;
  sample_size: number | null;
  population: string | null;
  margin_of_error: number | null;
  results: PollResult[];
}

interface PollsResponse {
  poll_count: number;
  polls: Poll[];
}

interface CandidateAverage {
  name: string;
  party: string;
  avg: number;
}

function partyColor(party: string): string {
  if (party === "D") return "bg-blue-500";
  if (party === "R") return "bg-red-500";
  return "bg-terminal-dim";
}

function partyText(party: string): string {
  if (party === "D") return "text-terminal-blue";
  if (party === "R") return "text-terminal-red";
  return "text-terminal-dim";
}

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function PollsSection() {
  const [data, setData] = useState<PollsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/polls?limit=30&race=ME-General")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-terminal-sm text-terminal-dim py-4 text-center animate-pulse">
        Loading polls...
      </div>
    );
  }

  if (!data || data.poll_count === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-terminal-base text-terminal-dim font-medium tracking-wider uppercase">
          Polls
        </h3>
        <div className="bg-terminal-panel border border-border rounded px-4 py-6 text-center">
          <p className="text-terminal-base text-terminal-muted">
            No polls available yet
          </p>
          <p className="text-terminal-sm text-terminal-dim mt-1">
            General election polling will appear here as the 2026 race heats up
          </p>
        </div>
      </div>
    );
  }

  // Compute candidate averages — general election only, Platner & Collins
  const GENERAL_CANDIDATES = ["Graham Platner", "Susan Collins"];
  const totals: Record<string, { sum: number; count: number; party: string }> = {};
  for (const poll of data.polls) {
    for (const r of poll.results) {
      const name = r.matched_name || r.candidate_name;
      if (!GENERAL_CANDIDATES.includes(name)) continue; // skip Mills, Undecided, etc.
      const party = r.matched_party || r.party || "";
      if (!totals[name]) totals[name] = { sum: 0, count: 0, party };
      totals[name].sum += r.percentage;
      totals[name].count += 1;
    }
  }

  const averages: CandidateAverage[] = Object.entries(totals)
    .map(([name, t]) => ({ name, party: t.party, avg: t.sum / t.count }))
    .sort((a, b) => b.avg - a.avg);

  const maxAvg = averages.length > 0 ? averages[0].avg : 1;

  return (
    <div className="flex flex-col gap-3">
      {/* Poll Averages */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-terminal-base text-terminal-dim font-medium tracking-wider uppercase">
            Poll Averages
          </h3>
          <span className="text-terminal-xs text-terminal-blue tracking-wider">GENERAL ELECTION — PLATNER vs. COLLINS</span>
        </div>
        <div className="flex flex-col gap-1">
          {averages.map((c) => {
            const isPlatner = c.name.toLowerCase().includes("platner");
            const barPct = maxAvg > 0 ? (c.avg / maxAvg) * 100 : 0;
            return (
              <div
                key={c.name}
                className={`flex items-center gap-2 px-3 py-1.5 rounded ${
                  isPlatner
                    ? "bg-terminal-yellow/10 border border-terminal-yellow/20"
                    : "bg-terminal-panel border border-border"
                }`}
              >
                <span
                  className={`text-terminal-base flex-1 truncate ${
                    isPlatner ? "text-terminal-yellow font-medium" : ""
                  }`}
                >
                  {c.name}
                </span>
                <div className="w-32 h-3 bg-terminal-raised rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${
                      isPlatner ? "bg-terminal-yellow" : partyColor(c.party)
                    }`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span
                  className={`text-terminal-base tabular-nums w-14 text-right font-semibold ${
                    isPlatner ? "text-terminal-yellow" : partyText(c.party)
                  }`}
                >
                  {c.avg.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Polls Table */}
      <div className="flex flex-col gap-2">
        <h3 className="text-terminal-base text-terminal-dim font-medium tracking-wider uppercase">
          Recent General Election Polls
        </h3>
        <div className="flex flex-col gap-1">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-terminal-sm text-terminal-dim">
            <span className="w-28 shrink-0">Pollster</span>
            <span className="w-16 shrink-0">Date</span>
            <span className="w-12 shrink-0 text-right">Sample</span>
            <span className="w-8 shrink-0 text-center">Pop</span>
            <span className="flex-1">Results</span>
          </div>

          {data.polls.map((poll) => (
            <div
              key={poll.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-terminal-panel border border-border rounded text-terminal-sm"
            >
              <span className="w-28 shrink-0 truncate text-terminal-base">
                {poll.pollster}
              </span>
              <span className="w-16 shrink-0 text-terminal-dim tabular-nums">
                {formatDate(poll.end_date)}
              </span>
              <span className="w-12 shrink-0 text-right text-terminal-dim tabular-nums">
                {poll.sample_size ?? "-"}
              </span>
              <span className="w-8 shrink-0 text-center text-terminal-muted">
                {poll.population || "-"}
              </span>
              <span className="flex-1 flex gap-2 overflow-hidden">
                {poll.results.slice(0, 4).map((r) => {
                  const name = r.matched_name || r.candidate_name;
                  const lastName = name.split(" ").pop();
                  const party = r.matched_party || r.party || "";
                  const isPlatner = name.toLowerCase().includes("platner");
                  return (
                    <span
                      key={name}
                      className={`tabular-nums ${
                        isPlatner
                          ? "text-terminal-yellow font-medium"
                          : partyText(party)
                      }`}
                    >
                      {lastName} {r.percentage}%
                    </span>
                  );
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";

interface CandidateData {
  name: string;
  party: string;
  handle: string;
  subscribers: number;
}

interface FollowerResponse {
  candidates: CandidateData[];
  latestDate: string | null;
  error?: string;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SocialOverview() {
  const [data, setData] = useState<FollowerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/social/followers")
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
      })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><span className="text-terminal-yellow glow-yellow animate-pulse">Loading...</span></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center py-12"><span className="text-terminal-red">ERR: {error}</span></div>;
  }

  if (!data || data.candidates.length === 0) {
    return <div className="flex items-center justify-center py-12"><span className="text-terminal-dim">No subscriber data available</span></div>;
  }

  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-terminal-xs text-terminal-blue font-medium tracking-widest uppercase">YouTube Subscribers</h3>
        {data.latestDate && (
          <span className="text-terminal-xs text-terminal-dim">as of {formatDate(data.latestDate)}</span>
        )}
      </div>
      {data.candidates.map(c => (
        <div key={c.name} className="bg-terminal-panel border border-border rounded px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-terminal-base font-medium truncate">{c.name}</span>
            <span className="text-terminal-xs text-terminal-dim truncate">{c.handle}</span>
          </div>
          <span className="text-terminal-base text-terminal-yellow tabular-nums font-semibold shrink-0 ml-2">
            {formatCount(c.subscribers)}
          </span>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { FinanceTable } from "./finance-table";
import { formatCurrency, formatNumber } from "./format";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DonorsTabProps {
  candidateId: number | null;
  onSelectCandidate: (id: number) => void;
}

export function DonorsTab({ candidateId, onSelectCandidate }: DonorsTabProps) {
  const [donors, setDonors] = useState<any[]>([]);
  const [lateData, setLateData] = useState<{ summary: any[]; by_state: any[]; by_occupation: any[] }>({ summary: [], by_state: [], by_occupation: [] });
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchDonors = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (source) params.set("source", source);
    return fetch(`/api/finance/donors?${params}`).then((r) => r.json());
  }, [search, source]);

  useEffect(() => {
    setLoading(true);
    if (candidateId) {
      Promise.all([
        fetchDonors(),
        fetch(`/api/finance/late-contributions?candidate_id=${candidateId}`).then((r) => r.json()),
      ])
        .then(([d, lc]) => {
          setDonors(d.filter((row: any) => row.candidate_id === candidateId));
          setLateData(lc);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        fetchDonors(),
        fetch("/api/finance/late-contributions").then((r) => r.json()),
      ])
        .then(([d, lc]) => {
          setDonors(d);
          setLateData(lc);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [candidateId, fetchDonors]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-terminal-yellow glow-yellow animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Search and filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-terminal-dim" size={12} />
          <Input
            placeholder="Search donors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-terminal-sm bg-terminal-raised border-border placeholder:text-terminal-muted"
          />
        </div>
        <div className="flex gap-1">
          {["", "form460", "s497"].map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-2 py-1 rounded text-terminal-xs transition-colors ${
                source === s
                  ? "bg-terminal-raised text-terminal-yellow border border-terminal-yellow/30"
                  : "bg-terminal-panel text-terminal-dim border border-border hover:text-foreground"
              }`}
            >
              {s === "" ? "All" : s === "form460" ? "460" : "S497"}
            </button>
          ))}
        </div>
      </div>

      {/* Donors table */}
      {donors.length === 0 ? (
        <div className="bg-terminal-panel border border-border rounded p-5 flex flex-col gap-2">
          <p className="text-terminal-base text-foreground font-medium">Itemized donor data not yet loaded</p>
          <p className="text-terminal-sm text-terminal-dim">
            Platner raised $7.87M through Dec 31, 2025 — 99% from donors giving under $200 (avg $25–33).
            Itemized contributions ($2.32M) require parsing FEC bulk files.
          </p>
          <a
            href="https://www.fec.gov/data/committee/C00916437/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-terminal-sm text-terminal-yellow hover:underline"
          >
            View raw FEC data → fec.gov/data/committee/C00916437
          </a>
        </div>
      ) : (
        <FinanceTable
          columns={[
            { key: "candidate_name", label: "Candidate" },
            { key: "donor_name", label: "Donor" },
            { key: "amount", label: "Amount", align: "right", format: formatCurrency },
            { key: "donations", label: "#", align: "right", format: formatNumber },
            { key: "employer", label: "Employer" },
            { key: "city", label: "City" },
            { key: "state", label: "St", className: "w-8" },
          ]}
          rows={donors}
          onRowClick={(row) => !candidateId && row.candidate_id && onSelectCandidate(row.candidate_id)}
          highlightName=""
        />
      )}

      {/* Late contributions summary */}
      {lateData.summary.length > 0 && (
        <div className="bg-terminal-panel border border-border rounded p-3">
          <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
            Late Contributions (S497)
          </span>
          <FinanceTable
            columns={[
              { key: "name", label: "Candidate" },
              { key: "total_raised", label: "S497 Raised", align: "right", format: formatCurrency },
              { key: "donor_count", label: "Donors", align: "right", format: formatNumber },
              { key: "avg_donation", label: "Avg", align: "right", format: formatCurrency },
            ]}
            rows={lateData.summary}
            highlightName=""
          />
        </div>
      )}

      {/* Candidate mode: late contribution breakdowns */}
      {candidateId && lateData.by_state.length > 0 && (
        <div className="bg-terminal-panel border border-border rounded p-3">
          <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
            Late Contributions by State
          </span>
          <FinanceTable
            columns={[
              { key: "state", label: "State" },
              { key: "amount", label: "Amount", align: "right", format: formatCurrency },
            ]}
            rows={lateData.by_state}
            highlightName=""
          />
        </div>
      )}

      {candidateId && lateData.by_occupation.length > 0 && (
        <div className="bg-terminal-panel border border-border rounded p-3">
          <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block mb-2">
            Late Contributions by Occupation
          </span>
          <FinanceTable
            columns={[
              { key: "occupation", label: "Occupation" },
              { key: "amount", label: "Amount", align: "right", format: formatCurrency },
              { key: "count", label: "Count", align: "right", format: formatNumber },
            ]}
            rows={lateData.by_occupation}
            highlightName=""
          />
        </div>
      )}
    </div>
  );
}

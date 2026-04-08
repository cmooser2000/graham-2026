"use client";

import { useState, useEffect } from "react";
import { ElectionCountdown } from "./election-countdown";
import { SummaryTab } from "./summary-tab";
import { FundraisingTab } from "./fundraising-tab";
import { SpendingTab } from "./spending-tab";
import { GeographyTab } from "./geography-tab";
import { DonorsTab } from "./donors-tab";
import { DebtTab } from "./debt-tab";
import { FilingsTab } from "./filings-tab";
import { OutsideMoneyTab } from "./outside-money-tab";
import { CandidatePills } from "./candidate-pills";
import { KpiStrip, KPI } from "@/components/ui/kpi-strip";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "fundraising", label: "Fundraising" },
  { id: "spending", label: "Spending" },
  { id: "geography", label: "Geo" },
  { id: "donors", label: "Donors" },
  { id: "debt", label: "Debt" },
  { id: "outside-money", label: "Outside $" },
  { id: "filings", label: "Filings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface FinanceSummary {
  candidate_id: number;
  name: string;
  cash_on_hand: string | null;
  total_receipts: string | null;
  total_expenditures: string | null;
  unique_donors: string | null;
  s497_total_raised: string | null;
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function FinanceView() {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [candidateId, setCandidateId] = useState<number | null>(null);
  const [kpis, setKpis] = useState<KPI[]>([]);

  useEffect(() => {
    fetch("/api/finance/summary")
      .then(r => r.json())
      .then((rows: FinanceSummary[]) => {
        const num = (v: string | null) => parseFloat(v ?? "0") || 0;
        const totalRaised = rows.reduce((s, r) => s + num(r.total_receipts) + num(r.s497_total_raised), 0);
        const totalSpent = rows.reduce((s, r) => s + num(r.total_expenditures), 0);
        const totalDonors = rows.reduce((s, r) => s + num(r.unique_donors), 0);
        const topCOH = rows.reduce((best, r) => {
          const coh = num(r.cash_on_hand) + num(r.s497_total_raised);
          return coh > best.val ? { name: r.name.split(" ").pop() ?? "", val: coh } : best;
        }, { name: "", val: 0 });

        setKpis([
          { label: "TOTAL RAISED", value: fmtMoney(totalRaised), color: "yellow", sub: `${rows.length} candidates` },
          { label: "TOTAL SPENT", value: fmtMoney(totalSpent), color: "red", sub: `${Math.round((totalSpent / totalRaised) * 100) || 0}% burn` },
          { label: "DONORS", value: totalDonors > 0 ? totalDonors.toLocaleString() : "N/A", color: "cyan", sub: totalDonors === 0 ? "not in FEC filing" : undefined },
          { label: "TOP COH", value: fmtMoney(topCOH.val), color: "green", sub: topCOH.name },
        ]);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Top-line KPIs */}
      {kpis.length > 0 && <div className="px-3 pt-3"><KpiStrip kpis={kpis} /></div>}

      {/* Candidate selector */}
      <CandidatePills selectedId={candidateId} onSelect={setCandidateId} />

      {/* Election countdown */}
      <ElectionCountdown />

      {/* Sub-tab bar */}
      <div className="flex gap-1.5 px-3 pt-2 pb-2 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded text-terminal-sm whitespace-nowrap transition-colors ${
              tab.id === activeTab
                ? "bg-terminal-raised text-terminal-yellow border border-terminal-yellow/30"
                : "bg-terminal-panel text-terminal-dim border border-border hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {activeTab === "summary" && <SummaryTab candidateId={candidateId} onSelectCandidate={setCandidateId} />}
        {activeTab === "fundraising" && <FundraisingTab candidateId={candidateId} onSelectCandidate={setCandidateId} />}
        {activeTab === "spending" && <SpendingTab candidateId={candidateId} onSelectCandidate={setCandidateId} />}
        {activeTab === "geography" && <GeographyTab candidateId={candidateId} onSelectCandidate={setCandidateId} />}
        {activeTab === "donors" && <DonorsTab candidateId={candidateId} onSelectCandidate={setCandidateId} />}
        {activeTab === "debt" && <DebtTab candidateId={candidateId} onSelectCandidate={setCandidateId} />}
        {activeTab === "outside-money" && <OutsideMoneyTab candidateId={candidateId} onSelectCandidate={setCandidateId} />}
        {activeTab === "filings" && <FilingsTab candidateId={candidateId} onSelectCandidate={setCandidateId} />}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { TrendsChart } from "./trends-chart";
import { WikiChart } from "./wiki-chart";
import { YoutubeFeed } from "./youtube-feed";
import { KpiStrip, KPI } from "@/components/ui/kpi-strip";

const TABS = [
  { id: "youtube", label: "YouTube" },
  { id: "trends", label: "Trends" },
  { id: "wiki", label: "Wiki" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function daysUntilPrimary(): number {
  const primary = new Date("2026-06-09T00:00:00"); // Maine Democratic Primary
  const now = new Date();
  return Math.max(0, Math.ceil((primary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export function InternetView() {
  const [activeTab, setActiveTab] = useState<TabId>("youtube");
  const [kpis, setKpis] = useState<KPI[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/social/youtube").then(r => r.json()).catch(() => null),
      fetch("/api/social/followers").then(r => r.json()).catch(() => null),
    ]).then(([yt, followers]) => {
      const items: KPI[] = [];

      // Days until primary
      const days = daysUntilPrimary();
      items.push({ label: "PRIMARY", value: `${days}d`, color: days <= 30 ? "red" : "yellow", sub: "Jun 9, 2026" });

      if (yt?.channels?.length) {
        const totalSubs = yt.channels.reduce((s: number, c: { subscribers: number }) => s + (c.subscribers || 0), 0);
        const totalVids = yt.videos?.length ?? 0;
        items.push(
          { label: "YT SUBS", value: fmtCount(totalSubs), color: "red", sub: `${yt.channels.length} candidates` },
        );
      }

      if (followers?.candidates?.length) {
        const platner = followers.candidates.find((c: { name: string }) => c.name.toLowerCase().includes("platner"));
        if (platner) {
          items.push({ label: "PLATNER YT", value: fmtCount(platner.subscribers), color: "yellow", sub: platner.handle });
        }
      }

      if (items.length > 0) setKpis(items.slice(0, 4));
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Top-line KPIs */}
      {kpis.length > 0 && <div className="px-3 pt-3"><KpiStrip kpis={kpis} /></div>}

      <div className="flex gap-1.5 px-3 pt-3 pb-2 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded text-terminal-base whitespace-nowrap transition-colors ${
              tab.id === activeTab
                ? "bg-terminal-raised text-terminal-yellow border border-terminal-yellow/30"
                : "bg-terminal-panel text-terminal-dim border border-border hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === "youtube" && <YoutubeFeed />}
        {activeTab === "trends" && <TrendsChart />}
        {activeTab === "wiki" && <WikiChart />}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { TrendsChart } from "./trends-chart";
import { WikiChart } from "./wiki-chart";
import { YoutubeFeed } from "./youtube-feed";

const TABS = [
  { id: "youtube", label: "YouTube" },
  { id: "trends", label: "Trends" },
  { id: "wiki", label: "Wiki" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function InternetView() {
  const [activeTab, setActiveTab] = useState<TabId>("youtube");

  return (
    <div className="flex flex-col h-full">
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

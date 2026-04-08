"use client";

import { TrendingUp, DollarSign, Globe, Settings, MapPin } from "lucide-react";
import { useAppStore, ViewId } from "@/lib/store/app-store";

const TABS: { id: ViewId; label: string; icon: typeof TrendingUp }[] = [
  { id: "markets", label: "Markets", icon: TrendingUp },
  { id: "finance", label: "Finance", icon: DollarSign },
  { id: "internet", label: "Internet", icon: Globe },
  { id: "operations", label: "Ops", icon: Settings },
  { id: "field", label: "Turf Data", icon: MapPin },
];

export function NavTabs() {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);

  return (
    <nav className="flex items-stretch bg-terminal-panel border-t border-border pb-safe">
      {TABS.map((tab) => {
        const active = activeView === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
              active
                ? "text-terminal-yellow bg-terminal-raised"
                : "text-terminal-dim hover:text-terminal-yellow/60"
            }`}
          >
            <Icon size={18} strokeWidth={active ? 2 : 1.5} />
            <span className="text-terminal-xs font-medium tracking-wider">
              {tab.label}
            </span>
            {active && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-terminal-yellow" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { StaffDirectory } from "./staff-directory";
import { useDirectoryStore } from "@/lib/store/directory-store";

const TABS = [
  { id: "directory", label: "Directory" },
  { id: "links", label: "Links" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function OperationsView() {
  const [activeTab, setActiveTab] = useState<TabId>("directory");
  const links = useDirectoryStore((s) => s.getLinks());

  return (
    <div className="p-4 space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                active
                  ? "border-terminal-yellow text-terminal-yellow"
                  : "border-border text-terminal-dim hover:text-terminal-yellow/60"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "directory" && <StaffDirectory />}

      {activeTab === "links" && (
        <div className="space-y-2">
          {links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-4 py-3 rounded border border-border hover:border-terminal-yellow/50 hover:bg-terminal-raised transition-colors group"
            >
              <span className="text-sm group-hover:text-terminal-green transition-colors">
                {link.label}
              </span>
              <ExternalLink size={14} className="text-terminal-dim shrink-0 group-hover:text-terminal-yellow" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

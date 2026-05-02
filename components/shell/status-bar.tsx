"use client";

import { useEffect, useState } from "react";
import { useDataSource } from "@/lib/data/hooks";
import { format } from "date-fns";

const PRIMARY = new Date("2026-06-09T00:00:00"); // Maine Democratic Primary
const GENERAL = new Date("2026-11-03T00:00:00");

function daysUntil(target: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function StatusBar() {
  const ds = useDataSource();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const primaryDays = daysUntil(PRIMARY);
  const generalDays = daysUntil(GENERAL);

  return (
    <div className="flex items-center justify-between px-3 py-2.5 bg-terminal-panel border-b border-border text-terminal-base text-terminal-dim pt-safe min-w-0">
      <div className="flex flex-col min-w-0">
        <span className="text-terminal-yellow font-semibold tracking-wider leading-tight">GRAHAM 2026</span>
        <div className="flex items-center gap-2">
          <span className="text-terminal-blue text-terminal-xs tracking-wider">{ds.name}</span>
          <span className="text-terminal-yellow text-terminal-xs shrink-0 font-semibold">GENERAL {generalDays}d</span>
          <span className="text-terminal-dim text-terminal-xs shrink-0">PRIMARY {primaryDays}d</span>
        </div>
      </div>
      <div className="flex items-center gap-2 tabular-nums shrink-0 whitespace-nowrap">
        {now && (
          <span className="text-terminal-yellow">{format(now, "h:mm a")}</span>
        )}
      </div>
    </div>
  );
}

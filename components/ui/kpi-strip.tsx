"use client";

import { useEffect, useRef, useState } from "react";

export interface KPI {
  label: string;
  value: string;
  sub?: string;
  color?: "yellow" | "cyan" | "red" | "green" | "dim";
}

const colorClasses: Record<string, string> = {
  yellow: "text-terminal-yellow glow-yellow",
  cyan: "text-terminal-cyan glow-cyan",
  red: "text-terminal-red glow-red",
  green: "text-green-400",
  dim: "text-foreground",
};

function AnimatedValue({ value, delay }: { value: string; delay: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <span
      ref={ref}
      className="inline-block tabular-nums transition-all duration-500 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        filter: visible ? "blur(0)" : "blur(2px)",
      }}
    >
      {value}
    </span>
  );
}

export function KpiStrip({ kpis, className }: { kpis: KPI[]; className?: string }) {
  if (kpis.length === 0) return null;

  return (
    <div className={`grid gap-px bg-border/40 rounded overflow-hidden ${className ?? ""}`}
      style={{ gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, 1fr)` }}
    >
      {kpis.map((kpi, i) => (
        <div
          key={kpi.label}
          className="bg-terminal-panel px-3 py-2.5 flex flex-col min-w-0"
        >
          <span className="text-[9px] text-terminal-muted tracking-widest uppercase truncate">
            {kpi.label}
          </span>
          <span className={`text-terminal-xl font-semibold leading-tight mt-0.5 truncate ${colorClasses[kpi.color ?? "yellow"]}`}>
            <AnimatedValue value={kpi.value} delay={i * 80} />
          </span>
          {kpi.sub && (
            <span className="text-[9px] text-terminal-dim mt-0.5 truncate">{kpi.sub}</span>
          )}
        </div>
      ))}
    </div>
  );
}

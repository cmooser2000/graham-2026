"use client";

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  color?: "yellow" | "green" | "cyan" | "red";
}

export function MetricCard({ label, value, subtitle, color = "yellow" }: MetricCardProps) {
  const colorMap = {
    yellow: "text-terminal-yellow glow-yellow",
    green: "text-green-400",
    cyan: "text-terminal-cyan glow-cyan",
    red: "text-terminal-red glow-red",
  };

  return (
    <div className="bg-terminal-panel border border-border rounded px-3 py-3 flex-1 min-w-0">
      <span className="text-terminal-xs text-terminal-dim tracking-wider uppercase block truncate">
        {label}
      </span>
      <span className={`text-terminal-xl font-semibold tabular-nums block mt-0.5 ${colorMap[color]}`}>
        {value}
      </span>
      {subtitle && (
        <span className="text-terminal-xs text-terminal-dim mt-0.5 block truncate">{subtitle}</span>
      )}
    </div>
  );
}

"use client";

const PRIMARY = new Date("2026-06-09T00:00:00"); // Maine Democratic Primary
const GENERAL = new Date("2026-11-03T00:00:00");

function daysUntil(target: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function ElectionCountdown() {
  const primaryDays = daysUntil(PRIMARY);
  const generalDays = daysUntil(GENERAL);

  return (
    <div className="flex gap-1.5 px-3 pt-3 pb-1 overflow-x-auto">
      <div className="px-3 py-1.5 rounded text-terminal-sm whitespace-nowrap bg-terminal-panel border border-border flex items-center gap-2">
        <span className="text-terminal-dim">PRIMARY</span>
        <span className="text-terminal-yellow">{primaryDays}d</span>
        <span className="text-terminal-dim">Jun 9</span>
      </div>
      <div className="px-3 py-1.5 rounded text-terminal-sm whitespace-nowrap bg-terminal-panel border border-border flex items-center gap-2">
        <span className="text-terminal-dim">GENERAL</span>
        <span className="text-terminal-yellow">{generalDays}d</span>
        <span className="text-terminal-dim">Nov 3</span>
      </div>
    </div>
  );
}

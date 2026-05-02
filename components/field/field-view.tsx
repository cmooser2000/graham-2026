"use client";

import { KpiStrip } from "@/components/ui/kpi-strip";
import { Flag } from "lucide-react";

// ─── Mock data (replace with live API at /api/summary) ───────────────────────

const SCOREBOARD = [
  { label: "Doors Today", value: "847", color: "yellow" as const },
  { label: "Doors Total", value: "12,340", color: "cyan" as const },
  { label: "Confirmed 1st", value: "4,891", color: "green" as const },
  { label: "Volunteer Leads", value: "203", color: "yellow" as const },
];

const RCV = [
  { label: "Will rank 1st", pct: 39.6, color: "bg-green-500", textColor: "text-green-400", flag: false },
  { label: "Will rank but not 1st", pct: 12.1, color: "bg-amber-500", textColor: "text-amber-400", flag: false },
  { label: "Undecided", pct: 28.4, color: "bg-amber-500/70", textColor: "text-amber-400", flag: false },
  { label: "Confused about RCV", pct: 8.2, color: "bg-red-500", textColor: "text-terminal-red", flag: true },
  { label: "Opposed", pct: 11.7, color: "bg-red-700", textColor: "text-terminal-red", flag: false },
];

const COALITION = [
  { label: "Progressive Dem", pct: 34, color: "bg-blue-500" },
  { label: "Unenrolled-Progressive", pct: 28, color: "bg-sky-400" },
  { label: "Unenrolled-Moderate", pct: 21, color: "bg-teal-500" },
  { label: "Soft Republican", pct: 17, color: "bg-amber-500" },
];

const COUNTIES = [
  { name: "Cumberland",   knocked: 2840, goal: 4000 },
  { name: "Penobscot",    knocked: 2210, goal: 3500 },
  { name: "Kennebec",     knocked: 1890, goal: 2800 },
  { name: "York",         knocked: 1340, goal: 2200 },
  { name: "Androscoggin", knocked: 980,  goal: 1800 },
  { name: "Somerset",     knocked: 640,  goal: 1200 },
  { name: "Aroostook",    knocked: 520,  goal: 1100 },
  { name: "Oxford",       knocked: 490,  goal: 1000 },
  { name: "Waldo",        knocked: 380,  goal: 800  },
  { name: "Knox",         knocked: 310,  goal: 700  },
  { name: "Franklin",     knocked: 260,  goal: 600  },
  { name: "Hancock",      knocked: 240,  goal: 600  },
  { name: "Sagadahoc",    knocked: 190,  goal: 500  },
  { name: "Lincoln",      knocked: 170,  goal: 500  },
  { name: "Washington",   knocked: 90,   goal: 600  },
  { name: "Piscataquis",  knocked: 60,   goal: 400  },
];

// 14-day sparkline data — trending upward
const DAILY_PACE = [420, 390, 510, 480, 560, 530, 620, 590, 670, 710, 730, 780, 820, 847];

function statusColor(pct: number): string {
  if (pct >= 60) return "text-green-400";
  if (pct >= 35) return "text-amber-400";
  return "text-terminal-red";
}

function statusDot(pct: number): string {
  if (pct >= 60) return "bg-green-500";
  if (pct >= 35) return "bg-amber-500";
  return "bg-red-500";
}

function Sparkline({ data }: { data: number[] }) {
  const w = 260, h = 56, pad = 4;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  const last = pts[pts.length - 1].split(",");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 56 }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="#FFD700"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Area fill */}
      <polyline
        points={`${pad},${h - pad} ${pts.join(" ")} ${w - pad},${h - pad}`}
        fill="rgba(255,215,0,0.08)"
        stroke="none"
      />
      {/* Last point dot */}
      <circle cx={last[0]} cy={last[1]} r="3" fill="#FFD700" />
      {/* Last value label */}
      <text x={parseFloat(last[0]) - 4} y={parseFloat(last[1]) - 7} fill="#FFD700" fontSize="9" textAnchor="end" fontFamily="monospace">
        {data[data.length - 1]}
      </text>
    </svg>
  );
}

export function FieldView() {
  return (
    <div className="flex flex-col gap-3 p-3 pb-6 overflow-y-auto h-full">

      {/* ── Disclaimer Banner ───────────────────────────────────────── */}
      <div className="bg-terminal-red/10 border border-terminal-red/40 rounded px-4 py-3 flex flex-col gap-1">
        <span className="text-terminal-red font-semibold tracking-widest uppercase text-terminal-sm">
          ⚠ Illustrative Data Only — Not Real Field Numbers
        </span>
        <span className="text-terminal-xs text-terminal-dim leading-relaxed">
          The figures below are mock data for demonstration purposes only. They do not reflect actual doors knocked, volunteer activity, or voter contact from the Graham Platner campaign. Real turf data is managed in VoteBuilder.
        </span>
        <a
          href="https://www.votebuilder.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-terminal-xs text-terminal-cyan hover:text-terminal-yellow transition-colors tracking-wider mt-0.5"
        >
          → Access Graham Turf Data at votebuilder.com
        </a>
      </div>

      {/* ── Scoreboard ─────────────────────────────────────────────── */}
      <KpiStrip kpis={SCOREBOARD} />

      {/* ── Row 2: RCV + Coalition ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* RCV Breakdown */}
        <div className="bg-terminal-panel border border-border rounded p-3 flex flex-col gap-2">
          <span className="text-terminal-xs text-terminal-dim tracking-widest uppercase">RCV Breakdown</span>
          {RCV.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className={`text-terminal-xs flex items-center gap-1 ${row.textColor}`}>
                  {row.flag && <Flag size={10} className="shrink-0" />}
                  {row.label}
                  {row.flag && <span className="text-terminal-xs text-terminal-red ml-1">needs follow-up</span>}
                </span>
                <span className={`text-terminal-xs tabular-nums font-semibold ${row.textColor}`}>
                  {row.pct}%
                </span>
              </div>
              <div className="h-2 bg-terminal-bg rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${row.color}`}
                  style={{ width: `${row.pct * 2}%` /* scale: 50% = 100% bar */ }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Coalition Mix */}
        <div className="bg-terminal-panel border border-border rounded p-3 flex flex-col gap-2">
          <span className="text-terminal-xs text-terminal-dim tracking-widest uppercase">Coalition Mix</span>
          {COALITION.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-terminal-xs text-foreground">{row.label}</span>
                <span className="text-terminal-xs tabular-nums font-semibold text-terminal-cyan">{row.pct}%</span>
              </div>
              <div className="h-2 bg-terminal-bg rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${row.color}`}
                  style={{ width: `${row.pct * 2.5}%` /* scale: 40% = 100% bar */ }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 3: County Coverage + Daily Pace ─────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* County Coverage */}
        <div className="bg-terminal-panel border border-border rounded p-3">
          <span className="text-terminal-xs text-terminal-dim tracking-widest uppercase block mb-2">County Coverage</span>
          <div className="overflow-x-auto">
            <table className="w-full text-terminal-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-1 py-1 text-terminal-dim font-medium tracking-wider uppercase"></th>
                  <th className="text-left px-1 py-1 text-terminal-dim font-medium tracking-wider uppercase">County</th>
                  <th className="text-right px-1 py-1 text-terminal-dim font-medium tracking-wider uppercase">Doors</th>
                  <th className="text-right px-1 py-1 text-terminal-dim font-medium tracking-wider uppercase">%</th>
                </tr>
              </thead>
              <tbody>
                {COUNTIES.map((c) => {
                  const pct = Math.round((c.knocked / c.goal) * 100);
                  return (
                    <tr key={c.name} className="border-b border-border/40">
                      <td className="px-1 py-1">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusDot(pct)}`} />
                      </td>
                      <td className="px-1 py-1 text-foreground">{c.name}</td>
                      <td className="px-1 py-1 text-right tabular-nums">{c.knocked.toLocaleString()}</td>
                      <td className={`px-1 py-1 text-right tabular-nums font-semibold ${statusColor(pct)}`}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Pace */}
        <div className="bg-terminal-panel border border-border rounded p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-terminal-xs text-terminal-dim tracking-widest uppercase">Daily Pace</span>
            <span className="text-terminal-sm font-semibold text-terminal-yellow tabular-nums">
              DAYS TO PRIMARY: <span className="glow-yellow">62</span>
            </span>
          </div>
          <Sparkline data={DAILY_PACE} />
          <div className="flex items-center gap-3 mt-1">
            <span className="text-terminal-xs text-terminal-dim">14-day trend</span>
            <span className="text-terminal-xs text-green-400">↑ +101% vs 2 weeks ago</span>
          </div>
          {/* Mini day labels */}
          <div className="flex justify-between mt-0.5">
            {["14d", "7d", "1d"].map((l) => (
              <span key={l} className="text-[9px] text-terminal-muted">{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ──────────────────────────────────────────────── */}
      <div className="bg-terminal-panel border border-border rounded px-3 py-2.5 flex items-center justify-between gap-3">
        <span className="text-terminal-xs text-terminal-dim tracking-widest uppercase">
          Active Volunteers Today:{" "}
          <span className="text-terminal-yellow font-semibold tabular-nums">47</span>
        </span>
        {/* TODO: Replace href="#" with actual Field app URL when available */}
        <a
          href="#"
          className="text-terminal-xs text-terminal-cyan hover:text-terminal-yellow transition-colors tracking-wider border border-terminal-cyan/30 hover:border-terminal-yellow/40 rounded px-2 py-1"
        >
          → OPEN FIELD ADMIN
        </a>
      </div>

      {/* ── Disclaimer ──────────────────────────────────────────────── */}
      <p className="text-[9px] text-terminal-muted px-1">
        Field data — live sync coming. Connects to GP Field app API at /api/summary.
      </p>
    </div>
  );
}

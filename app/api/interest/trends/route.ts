import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const SOURCE_URL = "https://trends.google.com/trends/explore?q=Graham+Platner,Susan+Collins&geo=US-ME";

const PARTY_MAP: Record<string, string> = {
  "Graham Platner": "D",
  "Susan Collins": "R",
  "Janet Mills": "D",
};

/**
 * Attempt to parse a Google Trends formattedTime string like "Apr 1, 2026"
 * or "Apr 1 – 7, 2026" into an ISO date string "2026-04-01".
 * Falls through to the raw string if parsing fails.
 */
function parseTrendsDate(raw: string): string {
  // Handle range like "Apr 1 – 7, 2026" — use start date
  const cleaned = raw.replace(/\s*[–-]\s*\d+/, "").trim();
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return raw;
}

interface CandidateEntry {
  searchTerm?: string;
  data: { date: string; value: number }[];
  average?: number;
  peak?: number;
  peakDate?: string;
}

interface TrendsFile {
  timeSeries?: unknown[];
  analytics?: unknown;
  meta?: unknown;
  candidates?: Record<string, CandidateEntry>;
  note?: string;
  period?: { start: string; end: string; timeframe: string };
  region?: string;
  generated_at?: string;
}

function loadTrendsFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "google-trends.json");
    const raw = readFileSync(filePath, "utf-8");
    const data: TrendsFile = JSON.parse(raw);

    // ── New format: timeSeries already present ───────────────────────────────
    if (data.timeSeries && (data.timeSeries as unknown[]).length > 0) {
      return NextResponse.json({
        timeSeries: data.timeSeries,
        analytics: data.analytics || {},
        meta: {
          ...(data.meta || {}),
          source_url: SOURCE_URL,
        },
      });
    }

    // ── Legacy / pipeline format: candidates[name].data[] ────────────────────
    const candidates = data.candidates || {};
    const names = Object.keys(candidates);

    if (names.length === 0) {
      return NextResponse.json({
        timeSeries: [],
        analytics: {},
        meta: {
          dateRange: { from: null, to: null },
          lastDataDate: null,
          totalDataPoints: 0,
          candidateCount: 0,
          note: data.note || "No Google Trends data available yet. Pipeline runs every 6 hours.",
          source_url: SOURCE_URL,
        },
      });
    }

    // Convert to flat timeSeries rows
    const timeSeries: { name: string; party: string; date: string; search_interest: number }[] = [];
    const allDates: string[] = [];

    for (const [name, info] of Object.entries(candidates)) {
      for (const point of info.data) {
        const isoDate = parseTrendsDate(point.date);
        timeSeries.push({
          name,
          party: PARTY_MAP[name] || "D",
          date: isoDate,
          search_interest: point.value,
        });
        allDates.push(isoDate);
      }
    }

    // Sort by date
    timeSeries.sort((a, b) => a.date.localeCompare(b.date));
    allDates.sort();

    // Build analytics per candidate
    type TrendDirection = "rising" | "falling" | "flat" | null;
    const analytics: Record<string, {
      peak: { date: string };
      trendDirection: TrendDirection;
      rank: number;
      dataPoints: number;
      nonZeroDataPoints: number;
      hasPartialData: boolean;
    }> = {};

    const candidateAverages: { name: string; average: number }[] = [];

    for (const [name, info] of Object.entries(candidates)) {
      const values = info.data.map(d => d.value);
      const nonZero = values.filter(v => v > 0).length;
      const avg = info.average ?? (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0);
      const peakDate = info.peakDate ? parseTrendsDate(info.peakDate) : (allDates[allDates.length - 1] || "");

      // Trend direction: compare last 7 points vs previous 7
      let trendDirection: TrendDirection = null;
      if (values.length >= 7) {
        const recent = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
        const prior = values.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
        if (prior > 0) {
          const change = (recent - prior) / prior;
          if (change > 0.05) trendDirection = "rising";
          else if (change < -0.05) trendDirection = "falling";
          else trendDirection = "flat";
        }
      }

      candidateAverages.push({ name, average: avg });
      analytics[name] = {
        peak: { date: peakDate },
        trendDirection,
        rank: 0, // fill in after sorting
        dataPoints: values.length,
        nonZeroDataPoints: nonZero,
        hasPartialData: nonZero < values.length * 0.5,
      };
    }

    // Assign ranks by average
    candidateAverages.sort((a, b) => b.average - a.average);
    candidateAverages.forEach(({ name }, i) => {
      analytics[name].rank = i + 1;
    });

    const lastDate = allDates[allDates.length - 1] || null;
    const firstDate = allDates[0] || null;

    return NextResponse.json({
      timeSeries,
      analytics,
      meta: {
        dateRange: { from: firstDate, to: lastDate },
        lastDataDate: lastDate,
        totalDataPoints: timeSeries.length,
        candidateCount: names.length,
        note: data.note || `Google Trends relative search interest in Maine (${data.period?.timeframe || "1 month"})`,
        source_url: SOURCE_URL,
      },
    });
  } catch (err) {
    return NextResponse.json({
      timeSeries: [],
      analytics: {},
      meta: {
        dateRange: { from: null, to: null },
        lastDataDate: null,
        totalDataPoints: 0,
        candidateCount: 0,
        note: "Google Trends data not yet available for Maine 2026 Senate race",
        source_url: SOURCE_URL,
        error: String(err),
      },
    });
  }
}

export async function GET() {
  return loadTrendsFromJson();
}

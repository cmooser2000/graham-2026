import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadWikiFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "wiki-pageviews.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    const timeSeries: { name: string; party: string; date: string; views: number }[] = [];
    const analytics: Record<string, {
      totalViews: number; avgDaily: number; medianDaily: number;
      avg7d: number | null; avg7dDataPoints: number; peakDate: string;
      peakViews: number; latestViews: number; trendDirection: "up" | "down" | "flat" | null;
      trendPct: number | null; dataPoints: number; rank: number;
      spikes: { date: string; views: number; multiple: number }[];
    }> = {};

    const partyMap: Record<string, string> = { "Graham Platner": "D", "Susan Collins": "R", "Janet Mills": "D" };
    const candidateStats: { name: string; totalViews: number }[] = [];

    for (const [name, cand] of Object.entries(data.candidates as Record<string, { daily: { date: string; views: number }[] }>)) {
      const party = partyMap[name] || "";
      const sorted = (cand.daily || []).sort((a, b) => a.date.localeCompare(b.date));

      for (const entry of sorted) {
        timeSeries.push({ name, party, date: entry.date, views: entry.views });
      }

      if (sorted.length === 0) continue;
      const totalViews = sorted.reduce((s, e) => s + e.views, 0);
      const avgDaily = Math.round(totalViews / sorted.length);
      const viewsSorted = sorted.map(e => e.views).sort((a, b) => a - b);
      const mid = Math.floor(viewsSorted.length / 2);
      const medianDaily = viewsSorted.length % 2 === 0
        ? Math.round((viewsSorted[mid - 1] + viewsSorted[mid]) / 2)
        : viewsSorted[mid];
      const last7 = sorted.slice(-7).filter(e => e.views > 0);
      const avg7d = last7.length > 0 ? Math.round(last7.reduce((s, e) => s + e.views, 0) / last7.length) : null;
      const peak = sorted.reduce((best, e) => (e.views > best.views ? e : best), sorted[0]);
      const latest = sorted[sorted.length - 1];

      let trendPct: number | null = null;
      let trendDirection: "up" | "down" | "flat" | null = null;
      if (sorted.length >= 14) {
        const prev7 = sorted.slice(-14, -7).filter(e => e.views > 0);
        const curr7 = sorted.slice(-7).filter(e => e.views > 0);
        if (prev7.length > 0 && curr7.length > 0) {
          const p = prev7.reduce((s, e) => s + e.views, 0) / prev7.length;
          const c = curr7.reduce((s, e) => s + e.views, 0) / curr7.length;
          if (p > 0) {
            trendPct = Math.round(((c - p) / p) * 100);
            trendDirection = trendPct > 0 ? "up" : trendPct < 0 ? "down" : "flat";
          }
        }
      }

      candidateStats.push({ name, totalViews });
      analytics[name] = {
        totalViews, avgDaily, medianDaily, avg7d, avg7dDataPoints: last7.length,
        peakDate: peak.date, peakViews: peak.views, latestViews: latest.views,
        trendDirection, trendPct, dataPoints: sorted.length, rank: 0, spikes: [],
      };
    }

    candidateStats.sort((a, b) => b.totalViews - a.totalViews);
    candidateStats.forEach((c, i) => { analytics[c.name].rank = i + 1; });

    const allDates = timeSeries.map(r => r.date).sort();
    return NextResponse.json({
      timeSeries,
      analytics,
      meta: {
        dateRange: { from: allDates[0] || null, to: allDates[allDates.length - 1] || null },
        lastDataDate: allDates[allDates.length - 1] || null,
        totalDataPoints: timeSeries.length,
        candidateCount: Object.keys(analytics).length,
        incompleteCandidates: [],
        source: "Wikimedia REST API (via data/wiki-pageviews.json)",
        source_url: "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to load wiki pageviews", detail: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return loadWikiFromJson();
}

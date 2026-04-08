import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadTrendsFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "google-trends.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    if (!data.timeSeries || data.timeSeries.length === 0) {
      return NextResponse.json({
        timeSeries: [],
        analytics: {},
        meta: {
          dateRange: { from: null, to: null },
          lastDataDate: null,
          totalDataPoints: 0,
          candidateCount: 0,
          note: data.note || "No Google Trends data available",
          source_url: data.source_url || "https://trends.google.com/trends/explore?q=Graham+Platner&geo=US-ME",
        },
      });
    }

    return NextResponse.json({
      timeSeries: data.timeSeries,
      analytics: data.analytics || {},
      meta: {
        ...(data.meta || {}),
        source_url: data.source_url || "https://trends.google.com/trends/explore?q=Graham+Platner&geo=US-ME",
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
        note: "Google Trends data not yet collected for Maine 2026 Senate race",
        source_url: "https://trends.google.com/trends/explore?q=Graham+Platner&geo=US-ME",
        error: String(err),
      },
    });
  }
}

export async function GET() {
  return loadTrendsFromJson();
}

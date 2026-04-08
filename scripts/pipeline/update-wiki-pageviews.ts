/**
 * Script to fetch Wikipedia pageviews for all candidates
 * Run with: npx tsx scripts/update-wiki-pageviews.ts
 *
 * Data source: Wikimedia REST API (no key required)
 * Rate limit: Be nice - 1 request per second
 */

import * as fs from "fs";
import * as path from "path";

const USER_AGENT = "GovAnalytics/1.0 (https://github.com/merinids/gov-analytics)";

// Wikipedia article titles for each candidate
const CANDIDATE_ARTICLES: Record<string, string> = {
  "Eric Swalwell": "Eric_Swalwell",
  "Antonio Villaraigosa": "Antonio_Villaraigosa",
  "Katie Porter": "Katie_Porter",
  "Tony Thurmond": "Tony_Thurmond",
  "Xavier Becerra": "Xavier_Becerra",
  "Tom Steyer": "Tom_Steyer",
  "Betty Yee": "Betty_Yee",
  "Chad Bianco": "Chad_Bianco",
  "Steve Hilton": "Steve_Hilton",
  "Matt Mahan": "Matt_Mahan",
  "Rick Caruso": "Rick_Caruso",
  "Alex Padilla": "Alex_Padilla",
};

interface DailyView {
  date: string;
  views: number;
}

interface CandidatePageviews {
  article: string;
  url: string;
  daily: DailyView[];
  total: number;
  average: number;
}

interface PageviewsFile {
  generated_at: string;
  period: {
    start: string;
    end: string;
  };
  candidates: Record<string, CandidatePageviews>;
}

interface WikiResponse {
  items: Array<{
    project: string;
    article: string;
    granularity: string;
    timestamp: string;
    views: number;
  }>;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatWikiDate(date: Date): string {
  // Wikimedia API wants YYYYMMDD format
  return date.toISOString().split("T")[0].replace(/-/g, "");
}

function parseWikiTimestamp(timestamp: string): string {
  // Convert YYYYMMDDHH to YYYY-MM-DD
  return `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;
}

async function fetchPageviews(article: string, start: Date, end: Date): Promise<DailyView[] | null> {
  const startStr = formatWikiDate(start);
  const endStr = formatWikiDate(end);

  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(article)}/daily/${startStr}/${endStr}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!res.ok) {
      console.error(`  API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data: WikiResponse = await res.json();

    return data.items.map((item) => ({
      date: parseWikiTimestamp(item.timestamp),
      views: item.views,
    }));
  } catch (err) {
    console.error(`  Fetch error: ${err}`);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const dataPath = path.join(__dirname, "../../data/wiki-pageviews.json");

  // Calculate date range (last 90 days)
  const end = new Date();
  end.setDate(end.getDate() - 1); // Yesterday (today's data might be incomplete)
  const start = new Date(end);
  start.setDate(start.getDate() - 89); // 90 days total

  console.log(`Fetching Wikipedia pageviews from ${formatDate(start)} to ${formatDate(end)}...\n`);

  const results: Record<string, CandidatePageviews> = {};

  for (const [name, article] of Object.entries(CANDIDATE_ARTICLES)) {
    console.log(`Fetching ${name} (${article})...`);

    const daily = await fetchPageviews(article, start, end);

    if (daily && daily.length > 0) {
      const total = daily.reduce((sum, d) => sum + d.views, 0);
      const average = Math.round(total / daily.length);

      results[name] = {
        article,
        url: `https://en.wikipedia.org/wiki/${article}`,
        daily,
        total,
        average,
      };

      console.log(`  Total: ${total.toLocaleString()} views, Avg: ${average.toLocaleString()}/day`);
    } else {
      console.log(`  Failed to fetch data`);
    }

    // Rate limit: 1 request per second
    await sleep(1000);
  }

  const output: PageviewsFile = {
    generated_at: new Date().toISOString(),
    period: {
      start: formatDate(start),
      end: formatDate(end),
    },
    candidates: results,
  };

  fs.writeFileSync(dataPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${dataPath}`);

  // Summary
  console.log("\n=== Summary ===");
  const sorted = Object.entries(results)
    .map(([name, data]) => ({ name, total: data.total, average: data.average }))
    .sort((a, b) => b.total - a.total);

  for (const { name, total, average } of sorted) {
    console.log(`${name.padEnd(25)} ${total.toLocaleString().padStart(10)} total  ${average.toLocaleString().padStart(6)}/day`);
  }
}

main().catch(console.error);

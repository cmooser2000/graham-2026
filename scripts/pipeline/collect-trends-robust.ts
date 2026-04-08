/**
 * Robust Google Trends collector for California Governor candidates
 * Run with: npx tsx scripts/collect-trends-robust.ts
 *
 * Improvements over update-google-trends.ts:
 * - Retry logic with exponential backoff (3 attempts per batch)
 * - Rate limit detection (429 status + body checks)
 * - Partial result saving (saves whatever succeeded if later batches fail)
 * - Clear logging of successes and failures
 *
 * Uses Google Trends unofficial API via direct fetch
 * Limited to comparing 5 candidates at a time
 * Region: US-CA (California)
 */

import * as fs from "fs";
import * as path from "path";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000; // 2s, 4s, 8s exponential backoff
const BATCH_DELAY_MS = 3000; // delay between batches

// Candidate search terms — Maine 2026 Senate race
const CANDIDATE_SEARCH_TERMS: Record<string, string> = {
  "Graham Platner": "Graham Platner",
  "Susan Collins": "Susan Collins",
  "Janet Mills": "Janet Mills",
};

interface TrendPoint {
  date: string;
  value: number;
}

interface CandidateTrend {
  searchTerm: string;
  data: TrendPoint[];
  average: number;
  peak: number;
  peakDate: string;
}

interface TrendsFile {
  generated_at: string;
  period: {
    start: string;
    end: string;
    timeframe: string;
  };
  region: string;
  note: string;
  candidates: Record<string, CandidateTrend>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimited(status: number, body: string): boolean {
  if (status === 429) return true;
  const lower = body.toLowerCase();
  return (
    lower.includes("rate limit") ||
    lower.includes("limit exceeded") ||
    lower.includes("too many requests") ||
    lower.includes("quota exceeded")
  );
}

function stripGooglePrefix(text: string): string {
  if (text.startsWith(")]}'")) {
    return text.slice(5);
  }
  return text;
}

/**
 * Fetch trends comparison for a batch of terms, with retry logic.
 * Returns null only if all retries are exhausted.
 */
async function fetchTrendsComparison(
  terms: string[],
  geo: string,
  timeframe: string
): Promise<Record<string, TrendPoint[]> | null> {
  const comparisonItems = terms.map((term) => ({
    keyword: term,
    geo,
    time: timeframe,
  }));

  const req = {
    comparisonItem: comparisonItems,
    category: 0,
    property: "",
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`  Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
        await sleep(delay);
      }

      // Step 1: Get tokens from explore endpoint
      const exploreUrl = `https://trends.google.com/trends/api/explore?hl=en-US&tz=480&req=${encodeURIComponent(JSON.stringify(req))}`;

      const exploreRes = await fetch(exploreUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });

      const exploreText = await exploreRes.text();

      if (!exploreRes.ok) {
        if (isRateLimited(exploreRes.status, exploreText)) {
          console.error(`  Rate limited on explore (attempt ${attempt})`);
          continue;
        }
        console.error(`  Explore API error: ${exploreRes.status} (attempt ${attempt})`);
        continue;
      }

      const exploreData = JSON.parse(stripGooglePrefix(exploreText));
      const widgets = exploreData.widgets;

      const timeWidget = widgets?.find((w: { id: string }) => w.id === "TIMESERIES");
      if (!timeWidget) {
        console.error(`  No TIMESERIES widget found (attempt ${attempt})`);
        continue;
      }

      const token = timeWidget.token;
      const widgetReq = timeWidget.request;

      // Step 2: Fetch timeseries data
      await sleep(500);

      const multilineUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=480&req=${encodeURIComponent(JSON.stringify(widgetReq))}&token=${token}`;

      const dataRes = await fetch(multilineUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });

      const dataText = await dataRes.text();

      if (!dataRes.ok) {
        if (isRateLimited(dataRes.status, dataText)) {
          console.error(`  Rate limited on multiline (attempt ${attempt})`);
          continue;
        }
        console.error(`  Multiline API error: ${dataRes.status} (attempt ${attempt})`);
        continue;
      }

      const timelineData = JSON.parse(stripGooglePrefix(dataText));
      const results: Record<string, TrendPoint[]> = {};

      terms.forEach((term) => {
        results[term] = [];
      });

      if (timelineData.default?.timelineData) {
        for (const point of timelineData.default.timelineData) {
          const date = point.formattedTime;
          const values = point.value;

          terms.forEach((term, index) => {
            if (values[index] !== undefined) {
              results[term].push({
                date,
                value: values[index],
              });
            }
          });
        }
      }

      return results;
    } catch (err) {
      console.error(`  Fetch error (attempt ${attempt}): ${err}`);
      continue;
    }
  }

  return null;
}

function computeStats(
  data: TrendPoint[]
): { average: number; peak: number; peakDate: string } {
  const values = data.map((d) => d.value);
  const average = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
  const peak = values.length > 0 ? Math.max(...values) : 0;
  const peakIdx = values.indexOf(peak);
  return { average, peak, peakDate: data[peakIdx]?.date || "" };
}

function normalizeData(
  data: TrendPoint[],
  baselineBatch1: TrendPoint[],
  baselineBatchN: TrendPoint[]
): TrendPoint[] {
  if (baselineBatch1.length === 0 || baselineBatchN.length === 0) return data;

  const avg1 = baselineBatch1.reduce((a, b) => a + b.value, 0) / baselineBatch1.length;
  const avgN = baselineBatchN.reduce((a, b) => a + b.value, 0) / baselineBatchN.length;
  const ratio = avgN > 0 ? avg1 / avgN : 1;

  return data.map((point) => ({
    date: point.date,
    value: Math.round(point.value * ratio),
  }));
}

function saveResults(
  allResults: Record<string, CandidateTrend>,
  dataPath: string,
  geo: string,
  timeframe: string,
  failedBatches: string[]
) {
  const allDates = Object.values(allResults).flatMap((c) => c.data.map((d) => d.date));
  const startDate = allDates.length > 0 ? allDates[0] : "";
  const endDate = allDates.length > 0 ? allDates[allDates.length - 1] : "";

  let note = "Values are relative (0-100 scale). Higher = more search interest. Normalized against Eric Swalwell baseline.";
  if (failedBatches.length > 0) {
    note += ` PARTIAL DATA: failed to collect batches for: ${failedBatches.join(", ")}.`;
  }

  const output: TrendsFile = {
    generated_at: new Date().toISOString(),
    period: { start: startDate, end: endDate, timeframe },
    region: geo,
    note,
    candidates: allResults,
  };

  fs.writeFileSync(dataPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${Object.keys(allResults).length} candidates to ${dataPath}`);
}

async function main() {
  const dataPath = path.join(__dirname, "../../data/google-trends.json");
  const geo = "US-ME";
  const timeframe = "today 1-m";

  console.log("Fetching Google Trends data for Maine Senate candidates...");
  console.log(`Region: ${geo}, Timeframe: ${timeframe}`);
  console.log(`Retries: ${MAX_RETRIES}, Backoff: exponential from ${BASE_DELAY_MS}ms\n`);

  const allResults: Record<string, CandidateTrend> = {};
  const failedBatches: string[] = [];
  const terms = Object.entries(CANDIDATE_SEARCH_TERMS);
  const baselineTerm = "Graham Platner";

  // Split into batches of up to 5 (Google Trends limit)
  // Batch 1 includes the baseline; subsequent batches prepend the baseline for normalization
  const batch1Terms = terms.slice(0, 5);
  const remainingTerms = terms.slice(5);

  // Create batches of 4 from remaining (leaving room for baseline)
  const laterBatches: [string, string][][] = [];
  for (let i = 0; i < remainingTerms.length; i += 4) {
    laterBatches.push(remainingTerms.slice(i, i + 4));
  }

  // ── Batch 1 ──
  const batch1SearchTerms = batch1Terms.map(([, term]) => term);
  console.log(`Batch 1/${1 + laterBatches.length}: ${batch1SearchTerms.join(", ")}`);

  const results1 = await fetchTrendsComparison(batch1SearchTerms, geo, timeframe);

  if (!results1) {
    console.error("\nFailed to fetch batch 1 after all retries.");
    console.error("This is the baseline batch — cannot proceed without it.");
    const placeholder: TrendsFile = {
      generated_at: new Date().toISOString(),
      period: { start: "", end: "", timeframe },
      region: geo,
      note: "Google Trends API unavailable after retries. Rate-limited or blocked.",
      candidates: {},
    };
    fs.writeFileSync(dataPath, JSON.stringify(placeholder, null, 2));
    console.log(`Wrote placeholder to ${dataPath}`);
    process.exit(1);
  }

  console.log("  Batch 1 succeeded!");
  for (const [name, term] of batch1Terms) {
    const data = results1[term] || [];
    const stats = computeStats(data);
    allResults[name] = { searchTerm: term, data, ...stats };
    console.log(`    ${name}: avg ${stats.average}, peak ${stats.peak}`);
  }

  const baselineData = allResults[baselineTerm]?.data || [];

  // ── Later batches (with baseline for normalization) ──
  for (let i = 0; i < laterBatches.length; i++) {
    const batch = laterBatches[i];
    const batchNum = i + 2;
    const totalBatches = 1 + laterBatches.length;

    await sleep(BATCH_DELAY_MS);

    const batchSearchTerms = [baselineTerm, ...batch.map(([, term]) => term)];
    console.log(`\nBatch ${batchNum}/${totalBatches}: ${batchSearchTerms.join(", ")}`);

    const results = await fetchTrendsComparison(batchSearchTerms, geo, timeframe);

    if (!results) {
      const failedNames = batch.map(([name]) => name);
      console.error(`  Batch ${batchNum} failed after all retries. Skipping: ${failedNames.join(", ")}`);
      failedBatches.push(...failedNames);
      // Save partial results so far
      saveResults(allResults, dataPath, geo, timeframe, failedBatches);
      console.log("  (Partial results saved)");
      continue;
    }

    console.log(`  Batch ${batchNum} succeeded!`);
    const batchBaseline = results[baselineTerm] || [];

    for (const [name, term] of batch) {
      const rawData = results[term] || [];
      const data = normalizeData(rawData, baselineData, batchBaseline);
      const stats = computeStats(data);
      allResults[name] = { searchTerm: term, data, ...stats };
      console.log(`    ${name}: avg ${stats.average}, peak ${stats.peak}`);
    }
  }

  // ── Final save ──
  saveResults(allResults, dataPath, geo, timeframe, failedBatches);

  // ── Summary ──
  console.log("\n=== Summary (by average interest) ===");
  const sorted = Object.entries(allResults)
    .map(([name, data]) => ({ name, average: data.average, peak: data.peak }))
    .sort((a, b) => b.average - a.average);

  for (const { name, average, peak } of sorted) {
    console.log(`${name.padEnd(25)} avg: ${String(average).padStart(3)}  peak: ${String(peak).padStart(3)}`);
  }

  if (failedBatches.length > 0) {
    console.log(`\n⚠ Missing candidates (rate limited): ${failedBatches.join(", ")}`);
    process.exit(1);
  } else {
    console.log(`\n✓ All ${Object.keys(allResults).length} candidates collected successfully.`);
  }
}

main().catch((err) => {
  console.error(`Fatal error: ${err}`);
  process.exit(1);
});

import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  // Compute dashboard metrics from the database
  // NOTE: Internet-pipeline queries use actual latest dates in the data,
  // not CURRENT_DATE, because data may be stale.
  const [totalRaised, totalDonors, candidates, avgBurn, topCOH, filingCount, socialReach, trending, wikiTotal] = await Promise.all([
    query(`SELECT COALESCE(SUM(COALESCE(cs.total_receipts, 0) + COALESCE(cs.s497_total_raised, 0)), 0) as val FROM campaign_summary cs`),
    query(`SELECT COALESCE(SUM(co.unique_donors), 0) as val FROM contributions co`),
    query(`SELECT count(*) as val FROM candidates WHERE is_primary = true`),
    query(`SELECT COALESCE(AVG(cs.burn_rate) FILTER (WHERE cs.burn_rate > 0), 0) as val FROM campaign_summary cs`),
    query(`SELECT COALESCE(MAX(cs.cash_on_hand), 0) as val FROM campaign_summary cs`),
    query(`SELECT count(*) as val FROM campaign_filings`),
    // YT SUBS: sum of all YouTube subscriber counts (only reliable social metric)
    query(`
      SELECT COALESCE(SUM(subscribers), 0) as val
      FROM youtube_channels
      WHERE subscribers > 0
    `),
    // TRENDING #1: candidate with highest avg search interest over last 7 days of data
    query(`
      WITH latest AS (SELECT MAX(date) as max_date FROM google_trends),
      recent AS (
        SELECT gt.candidate_id, AVG(gt.search_interest) as avg_interest
        FROM google_trends gt, latest l
        WHERE gt.date > l.max_date - INTERVAL '7 days'
        GROUP BY gt.candidate_id
        ORDER BY avg_interest DESC
        LIMIT 1
      )
      SELECT SPLIT_PART(c.name, ' ', array_length(string_to_array(c.name, ' '), 1)) as name,
             ROUND(r.avg_interest) as val
      FROM recent r
      JOIN candidates c ON c.id = r.candidate_id
    `),
    // WIKI VIEWS 7D: sum of pageviews in last 7 days of data (not CURRENT_DATE)
    query(`
      WITH latest AS (SELECT MAX(date) as max_date FROM wiki_pageviews)
      SELECT COALESCE(SUM(wp.views), 0) as val
      FROM wiki_pageviews wp, latest l
      WHERE wp.date > l.max_date - INTERVAL '7 days'
    `),
  ]);

  // Build trending label: "TREND #1: LASTNAME" or fallback
  const trendingRow = trending.rows[0];
  const trendLabel = trendingRow?.name
    ? `#1 ${trendingRow.name.toUpperCase()}`
    : "TREND #1";
  const trendValue = Number(trendingRow?.val ?? 0);

  const metrics = [
    { id: "total-raised", label: "TOTAL RAISED", value: Number(totalRaised.rows[0].val), format: "currency", category: "finance" },
    { id: "total-donors", label: "TOTAL DONORS", value: Number(totalDonors.rows[0].val), format: "compact", category: "finance" },
    { id: "candidates", label: "CANDIDATES", value: Number(candidates.rows[0].val), format: "number", category: "race" },
    { id: "avg-burn-rate", label: "AVG BURN RATE", value: Math.round(Number(avgBurn.rows[0].val) * 1000) / 10, format: "percent", category: "finance" },
    { id: "top-coh", label: "TOP COH", value: Number(topCOH.rows[0].val), format: "currency", category: "finance" },
    { id: "filings", label: "FILINGS", value: Number(filingCount.rows[0].val), format: "number", category: "data" },
    { id: "yt-subs", label: "YT SUBS", value: Number(socialReach.rows[0].val), format: "compact", category: "social" },
    { id: "trend-top", label: trendLabel, value: trendValue, format: "number", category: "interest" },
    { id: "wiki-views-7d", label: "WIKI VIEWS 7D", value: Number(wikiTotal.rows[0].val), format: "compact", category: "interest" },
  ];

  return NextResponse.json(metrics);
}

/**
 * LOCAL DEV SEEDING ONLY
 *
 * Production data flows through GitHub Actions in the gov-analytics repo
 * (merinids/swalwell/gov-analytics) → Neon Postgres. This script is kept
 * for bootstrapping a new dev environment or re-seeding after schema changes.
 *
 * Usage:
 *   1. Clone gov-analytics and run its pipelines to populate data/ JSON files
 *   2. npx tsx scripts/import-data.ts
 *
 * Requires: cagov_DATABASE_URL or DATABASE_URL env var (or defaults to localhost)
 */
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";

const DATA_DIR = "/Users/merinids/Desktop/code/merinids/swalwell/gov-analytics/data";
const DB_URL = process.env.cagov_DATABASE_URL || process.env.DATABASE_URL || "postgresql://localhost:5432/swallwell2026";

function readJSON(filename: string) {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), "utf-8"));
}

async function main() {
  // Skip local DB creation when using remote (Neon) connection
  if (!process.env.cagov_DATABASE_URL && DB_URL.includes("localhost")) {
    const adminClient = new Client({ connectionString: "postgresql://localhost:5432/postgres" });
    await adminClient.connect();
    const res = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = 'swallwell2026'");
    if (res.rowCount === 0) {
      await adminClient.query("CREATE DATABASE swallwell2026");
      console.log("Created database swallwell2026");
    }
    await adminClient.end();
  }

  const client = new Client({
    connectionString: DB_URL,
    ssl: DB_URL.includes("neon") || process.env.cagov_DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  // Run schema
  const schema = readFileSync(join(process.cwd(), "scripts/schema.sql"), "utf-8");
  await client.query(schema);
  console.log("Schema created");

  // Helper to get candidate ID
  const candidateIds: Record<string, number> = {};
  async function getCandidateId(name: string, filerId?: number, party?: string, isPrimary = true): Promise<number> {
    if (candidateIds[name]) return candidateIds[name];
    await client.query(
      `INSERT INTO candidates (name, filer_id, party, is_primary) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO UPDATE SET filer_id = COALESCE(EXCLUDED.filer_id, candidates.filer_id), party = COALESCE(EXCLUDED.party, candidates.party)`,
      [name, filerId || null, party || null, isPrimary]
    );
    const res = await client.query("SELECT id FROM candidates WHERE name = $1", [name]);
    candidateIds[name] = res.rows[0].id;
    return candidateIds[name];
  }

  // 1. Campaign Summary
  console.log("Importing campaign-summary.json...");
  try {
    await client.query("BEGIN");
    const summary = readJSON("campaign-summary.json");
    for (const [name, data] of Object.entries(summary.candidates) as [string, any][]) {
      const cid = await getCandidateId(name, data.filer_id);
      await client.query(
        `UPDATE candidates SET has_form_460 = $1 WHERE id = $2`,
        [data.has_form_460, cid]
      );
      await client.query(
        `INSERT INTO campaign_summary (candidate_id, cash_on_hand, total_receipts, total_expenditures, accrued_expenses, burn_rate, runway_months, s497_total_raised) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (candidate_id) DO NOTHING`,
        [cid, data.cash_on_hand, data.total_receipts, data.total_expenditures, data.accrued_expenses, data.burn_rate, data.runway_months, data.s497_total_raised || 0]
      );
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // 2. Contributions
  console.log("Importing campaign-contributions.json...");
  try {
    await client.query("BEGIN");
    const contribs = readJSON("campaign-contributions.json");
    for (const [name, data] of Object.entries(contribs.candidates) as [string, any][]) {
      const cid = await getCandidateId(name, data.filer_id);
      await client.query(
        `INSERT INTO contributions (candidate_id, total_raised, contribution_count, unique_donors, avg_contribution, repeat_donor_amount, repeat_donor_count, repeat_donor_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (candidate_id) DO NOTHING`,
        [cid, data.total_raised, data.contribution_count, data.unique_donors, data.avg_contribution, data.repeat_donor_amount, data.repeat_donor_count, data.repeat_donor_rate]
      );
      // By size
      for (const [bucket, amount] of Object.entries(data.by_size || {})) {
        const count = data.by_size_count?.[bucket] || 0;
        await client.query(
          `INSERT INTO contributions_by_size (candidate_id, size_bucket, amount, count) VALUES ($1,$2,$3,$4) ON CONFLICT (candidate_id, size_bucket) DO NOTHING`,
          [cid, bucket, amount, count]
        );
      }
      // By type
      for (const [dtype, amount] of Object.entries(data.by_type || {})) {
        const count = data.by_type_count?.[dtype] || 0;
        await client.query(
          `INSERT INTO contributions_by_type (candidate_id, donor_type, amount, count) VALUES ($1,$2,$3,$4) ON CONFLICT (candidate_id, donor_type) DO NOTHING`,
          [cid, dtype, amount, count]
        );
      }
      // Monthly
      for (const [month, amount] of Object.entries(data.contributions_by_month || {})) {
        await client.query(
          `INSERT INTO contributions_monthly (candidate_id, month, amount) VALUES ($1,$2,$3) ON CONFLICT (candidate_id, month) DO NOTHING`,
          [cid, month, amount]
        );
      }
      // Top donors (Form 460)
      for (const donor of data.top_donors || []) {
        await client.query(
          `INSERT INTO top_donors (candidate_id, source, donor_name, amount, donations) VALUES ($1,'form460',$2,$3,$4)`,
          [cid, donor.name, donor.amount, donor.donations]
        );
      }
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // 3. Late Contributions (S497 / campaign-finance.json)
  console.log("Importing campaign-finance.json (S497)...");
  try {
    await client.query("BEGIN");
    const finance = readJSON("campaign-finance.json");
    for (const [name, data] of Object.entries(finance.candidates) as [string, any][]) {
      const cid = await getCandidateId(name, data.filer_id);
      await client.query(
        `INSERT INTO late_contributions (candidate_id, total_raised, donor_count, avg_donation) VALUES ($1,$2,$3,$4) ON CONFLICT (candidate_id) DO NOTHING`,
        [cid, data.total_raised, data.donor_count, data.avg_donation]
      );
      // S497 top donors
      for (const donor of data.top_donors || []) {
        await client.query(
          `INSERT INTO top_donors (candidate_id, source, donor_name, amount, employer, occupation, city, state) VALUES ($1,'s497',$2,$3,$4,$5,$6,$7)`,
          [cid, donor.name, donor.amount, donor.employer || null, donor.occupation || null, donor.city || null, donor.state || null]
        );
      }
      // By state
      for (const [state, amount] of Object.entries(data.by_state || {})) {
        await client.query(
          `INSERT INTO late_contribution_by_state (candidate_id, state, amount) VALUES ($1,$2,$3) ON CONFLICT (candidate_id, state) DO NOTHING`,
          [cid, state, amount]
        );
      }
      // By occupation
      for (const [occupation, odata] of Object.entries(data.by_occupation || {}) as [string, any][]) {
        await client.query(
          `INSERT INTO late_contribution_by_occupation (candidate_id, occupation, count, amount) VALUES ($1,$2,$3,$4) ON CONFLICT (candidate_id, occupation) DO NOTHING`,
          [cid, occupation, odata.count, odata.amount]
        );
      }
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // 4. Spending
  console.log("Importing campaign-spending.json...");
  try {
    await client.query("BEGIN");
    const spending = readJSON("campaign-spending.json");
    for (const [name, data] of Object.entries(spending.candidates) as [string, any][]) {
      const cid = await getCandidateId(name, data.filer_id);
      await client.query(
        `INSERT INTO spending (candidate_id, total_spending, expenditure_count) VALUES ($1,$2,$3) ON CONFLICT (candidate_id) DO NOTHING`,
        [cid, data.total_spending, data.expenditure_count]
      );
      for (const [cat, amount] of Object.entries(data.by_category || {})) {
        await client.query(
          `INSERT INTO spending_by_category (candidate_id, category, amount) VALUES ($1,$2,$3) ON CONFLICT (candidate_id, category) DO NOTHING`,
          [cid, cat, amount]
        );
      }
      for (const vendor of data.top_vendors || []) {
        if (vendor.name) {
          await client.query(
            `INSERT INTO top_vendors (candidate_id, vendor_name, amount) VALUES ($1,$2,$3)`,
            [cid, vendor.name, vendor.amount]
          );
        }
      }
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // 5. Geography
  console.log("Importing campaign-geography.json...");
  try {
    await client.query("BEGIN");
    const geo = readJSON("campaign-geography.json");
    for (const [name, data] of Object.entries(geo.candidates) as [string, any][]) {
      const cid = await getCandidateId(name, data.filer_id);
      await client.query(
        `INSERT INTO geography (candidate_id, in_state_amount, out_of_state_amount, in_state_pct, diversity_score) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (candidate_id) DO NOTHING`,
        [cid, data.in_state, data.out_of_state, data.in_state_pct, data.diversity_score]
      );
      for (const [region, amount] of Object.entries(data.by_region || {})) {
        await client.query(
          `INSERT INTO geography_by_region (candidate_id, region, amount) VALUES ($1,$2,$3) ON CONFLICT (candidate_id, region) DO NOTHING`,
          [cid, region, amount]
        );
      }
      for (const city of data.top_cities || []) {
        await client.query(
          `INSERT INTO geography_top_cities (candidate_id, city, amount) VALUES ($1,$2,$3)`,
          [cid, city.city, city.amount]
        );
      }
      for (const state of data.top_states || []) {
        await client.query(
          `INSERT INTO geography_top_states (candidate_id, state, amount) VALUES ($1,$2,$3)`,
          [cid, state.state, state.amount]
        );
      }
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // 6. Debts
  console.log("Importing campaign-debts.json...");
  try {
    await client.query("BEGIN");
    const debts = readJSON("campaign-debts.json");
    for (const [name, data] of Object.entries(debts.candidates) as [string, any][]) {
      const cid = await getCandidateId(name, data.filer_id);
      await client.query(
        `INSERT INTO debts (candidate_id, total_debt, total_loans, self_loans) VALUES ($1,$2,$3,$4) ON CONFLICT (candidate_id) DO NOTHING`,
        [cid, data.total_debt, data.total_loans, data.self_loans]
      );
      for (const creditor of data.top_creditors || []) {
        await client.query(
          `INSERT INTO top_creditors (candidate_id, name, amount) VALUES ($1,$2,$3)`,
          [cid, creditor.creditor, creditor.amount]
        );
      }
      for (const lender of data.top_lenders || []) {
        await client.query(
          `INSERT INTO top_lenders (candidate_id, name, amount) VALUES ($1,$2,$3)`,
          [cid, lender.lender, lender.amount]
        );
      }
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // 7. Timeline
  console.log("Importing campaign-timeline.json...");
  try {
    await client.query("BEGIN");
    const timeline = readJSON("campaign-timeline.json");
    for (const [name, data] of Object.entries(timeline.candidates) as [string, any][]) {
      const cid = await getCandidateId(name);
      for (const m of data.monthly_data || []) {
        await client.query(
          `INSERT INTO campaign_timeline (candidate_id, month, contributions, spending, net, cumulative_raised, cumulative_spent, mom_growth, trail_3m_contrib) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (candidate_id, month) DO NOTHING`,
          [cid, m.month, m.contributions, m.spending, m.net, m.cumulative_raised, m.cumulative_spent, m.mom_growth ?? null, m.trail_3m_contrib ?? null]
        );
      }
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // 8. Filings
  console.log("Importing campaign-filings.json...");
  try {
    await client.query("BEGIN");
    const filings = readJSON("campaign-filings.json");
    for (const [name, data] of Object.entries(filings.candidates) as [string, any][]) {
      const cid = await getCandidateId(name);
      for (const f of data.filings || []) {
        await client.query(
          `INSERT INTO campaign_filings (candidate_id, filing_id, form_type, thru_date, rpt_date, cash_on_hand, receipts, expenditures) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [cid, f.filing_id, f.form_type, f.thru_date || null, f.rpt_date || null, f.cash_on_hand, f.period_receipts, f.period_expenditures]
        );
      }
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // 9. Social Stats
  console.log("Importing social-stats.json...");
  try {
    await client.query("BEGIN");
    const social = readJSON("social-stats.json");
    for (const [name, data] of Object.entries(social.candidates) as [string, any][]) {
      // Alex Padilla is not running for governor (US Senator)
      const isPrimary = !["Alex Padilla"].includes(name);
      const cid = await getCandidateId(name, undefined, data.party, isPrimary);
      // Accounts
      for (const [platform, account] of Object.entries(data.accounts || {}) as [string, any][]) {
        if (account) {
          await client.query(
            `INSERT INTO social_accounts (candidate_id, platform, handle, url) VALUES ($1,$2,$3,$4) ON CONFLICT (candidate_id, platform) DO NOTHING`,
            [cid, platform, account.handle, account.url]
          );
        }
      }
      // History
      for (const snapshot of data.history || []) {
        for (const platform of ["instagram", "tiktok", "youtube", "x"]) {
          if (snapshot[platform] !== null && snapshot[platform] !== undefined) {
            await client.query(
              `INSERT INTO social_follower_history (candidate_id, platform, date, followers) VALUES ($1,$2,$3,$4) ON CONFLICT (candidate_id, platform, date) DO NOTHING`,
              [cid, platform, snapshot.date, snapshot[platform]]
            );
          }
        }
      }
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // 10. Google Trends
  console.log("Importing google-trends.json...");
  try {
    await client.query("BEGIN");
    const trends = readJSON("google-trends.json");
    for (const [name, data] of Object.entries(trends.candidates) as [string, any][]) {
      const cid = await getCandidateId(name);
      for (const point of data.data || []) {
        // Parse date like "Jan 3, 2026"
        const date = new Date(point.date);
        if (!isNaN(date.getTime())) {
          const dateStr = date.toISOString().split("T")[0];
          await client.query(
            `INSERT INTO google_trends (candidate_id, date, search_interest) VALUES ($1,$2,$3) ON CONFLICT (candidate_id, date) DO NOTHING`,
            [cid, dateStr, point.value]
          );
        }
      }
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // 11. Wikipedia Pageviews
  console.log("Importing wiki-pageviews.json...");
  try {
    await client.query("BEGIN");
    const wiki = readJSON("wiki-pageviews.json");
    for (const [name, data] of Object.entries(wiki.candidates) as [string, any][]) {
      const cid = await getCandidateId(name);
      for (const point of data.daily || []) {
        await client.query(
          `INSERT INTO wiki_pageviews (candidate_id, date, views) VALUES ($1,$2,$3) ON CONFLICT (candidate_id, date) DO NOTHING`,
          [cid, point.date, point.views]
        );
      }
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // 12. YouTube
  console.log("Importing youtube-content.json...");
  try {
    await client.query("BEGIN");
    const yt = readJSON("youtube-content.json");
    for (const entry of yt.candidates || []) {
      const cid = await getCandidateId(entry.candidate, undefined, entry.party);
      // Channel
      if (entry.channelStats) {
        const cs = entry.channelStats;
        await client.query(
          `INSERT INTO youtube_channels (candidate_id, channel_id, handle, url, bio, verified, avatar, subscribers, total_videos) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (candidate_id) DO NOTHING`,
          [cid, entry.channelInfo?.channelId, entry.channelInfo?.handle, cs.url, cs.bio, cs.verified, cs.avatar, cs.subscribers, cs.totalVideos]
        );
      }
      // Videos
      for (const video of entry.recentVideos || []) {
        await client.query(
          `INSERT INTO youtube_videos (candidate_id, video_id, url, title, description, thumbnail, published_at, views, likes, comments, engagement, engagement_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (candidate_id, video_id) DO NOTHING`,
          [cid, video.id, video.url, video.title, video.description, video.thumbnail, video.publishedAt, video.views, video.likes, video.comments, video.engagement, video.engagementRate]
        );
      }
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // 15. Intel Analysis
  console.log("Importing intel-analysis.json...");
  try {
    await client.query("BEGIN");
    const intel = readJSON("intel-analysis.json");
    // Observations
    for (const obs of intel.observations || []) {
      await client.query(
        `INSERT INTO intel_observations (category, text) VALUES ('observation', $1)`,
        [obs]
      );
    }
    for (const note of intel.regional_notes || []) {
      await client.query(
        `INSERT INTO intel_observations (category, text) VALUES ('regional_note', $1)`,
        [note]
      );
    }
    // Snapshots
    for (const [name, data] of Object.entries(intel.snapshots || {}) as [string, any][]) {
      const cid = await getCandidateId(name);
      await client.query(
        `INSERT INTO intel_snapshots (candidate_id, has_form_460, cash_on_hand, total_raised_460, total_spent_460, s497_raised, s497_donors, s497_pac_pct, rcpt_total, unique_donors, repeat_rate, small_dollar_pct, committee_transfers, ca_pct, total_debt, burn_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (candidate_id) DO NOTHING`,
        [cid, data.has_form_460, data.cash_on_hand, data.total_raised_460, data.total_spent_460, data.s497_raised, data.s497_donors, data.s497_pac_pct, data.rcpt_total, data.unique_donors, data.repeat_rate, data.small_dollar_pct, data.committee_transfers, data.ca_pct, data.total_debt, data.burn_rate]
      );
    }
    await client.query("COMMIT");
    console.log("  Done");
  } catch (e) { await client.query("ROLLBACK"); console.error("  Failed:", e); }

  // Summary
  const counts = await client.query(`
    SELECT 'candidates' as t, count(*) FROM candidates UNION ALL
    SELECT 'campaign_summary', count(*) FROM campaign_summary UNION ALL
    SELECT 'contributions', count(*) FROM contributions UNION ALL
    SELECT 'top_donors', count(*) FROM top_donors UNION ALL
    SELECT 'spending', count(*) FROM spending UNION ALL
    SELECT 'top_vendors', count(*) FROM top_vendors UNION ALL
    SELECT 'debts', count(*) FROM debts UNION ALL
    SELECT 'geography', count(*) FROM geography UNION ALL
    SELECT 'campaign_timeline', count(*) FROM campaign_timeline UNION ALL
    SELECT 'campaign_filings', count(*) FROM campaign_filings UNION ALL
    SELECT 'late_contributions', count(*) FROM late_contributions UNION ALL
    SELECT 'social_accounts', count(*) FROM social_accounts UNION ALL
    SELECT 'social_follower_history', count(*) FROM social_follower_history UNION ALL
    SELECT 'google_trends', count(*) FROM google_trends UNION ALL
    SELECT 'wiki_pageviews', count(*) FROM wiki_pageviews UNION ALL
    SELECT 'youtube_channels', count(*) FROM youtube_channels UNION ALL
    SELECT 'youtube_videos', count(*) FROM youtube_videos UNION ALL
    SELECT 'intel_snapshots', count(*) FROM intel_snapshots UNION ALL
    SELECT 'intel_observations', count(*) FROM intel_observations
  `);

  console.log("\n=== Import Summary ===");
  for (const row of counts.rows) {
    console.log(`  ${row.t}: ${row.count} rows`);
  }

  await client.end();
  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

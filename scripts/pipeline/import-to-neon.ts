/**
 * Import collected JSON data into Neon Postgres
 * Designed to run in GitHub Actions after collection scripts
 *
 * Requires: DATABASE_URL environment variable (Neon connection string)
 * Run with: npx tsx scripts/import-to-neon.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const DATA_DIR = join(__dirname, "..", "..", "data");

function readJSON(filename: string) {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, filename), "utf-8"));
  } catch {
    console.log(`  Skipping ${filename} (not found or invalid)`);
    return null;
  }
}

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("Connected to Neon Postgres\n");

  // Helper to get or create candidate ID
  const candidateIds: Record<string, number> = {};
  async function getCandidateId(name: string, filerId?: number, party?: string, isPrimary = true): Promise<number> {
    if (candidateIds[name]) return candidateIds[name];
    await client.query(
      `INSERT INTO candidates (name, filer_id, party, is_primary) VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         filer_id = COALESCE(EXCLUDED.filer_id, candidates.filer_id),
         party = COALESCE(EXCLUDED.party, candidates.party),
         is_primary = EXCLUDED.is_primary`,
      [name, filerId || null, party || null, isPrimary]
    );
    const res = await client.query("SELECT id FROM candidates WHERE name = $1", [name]);
    candidateIds[name] = res.rows[0].id;
    return candidateIds[name];
  }

  // --- 1. CAMPAIGN SUMMARY ---
  console.log("Importing campaign-summary.json...");
  const summary = readJSON("campaign-summary.json");
  if (summary) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const [name, data] of Object.entries(summary.candidates) as [string, any][]) {
        const cid = await getCandidateId(name, data.filer_id);
        await client.query(
          `UPDATE candidates SET has_form_460 = $1 WHERE id = $2`,
          [data.has_form_460, cid]
        );
        await client.query(
          `INSERT INTO campaign_summary (candidate_id, cash_on_hand, total_receipts, total_expenditures, accrued_expenses, burn_rate, runway_months, s497_total_raised)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (candidate_id) DO UPDATE SET
             cash_on_hand = EXCLUDED.cash_on_hand, total_receipts = EXCLUDED.total_receipts,
             total_expenditures = EXCLUDED.total_expenditures, accrued_expenses = EXCLUDED.accrued_expenses,
             burn_rate = EXCLUDED.burn_rate, runway_months = EXCLUDED.runway_months,
             s497_total_raised = EXCLUDED.s497_total_raised`,
          [cid, data.cash_on_hand, data.total_receipts, data.total_expenditures, data.accrued_expenses, data.burn_rate, data.runway_months, data.s497_total_raised || 0]
        );
        rowCount++;
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 2. CONTRIBUTIONS ---
  console.log("Importing campaign-contributions.json...");
  const contribs = readJSON("campaign-contributions.json");
  if (contribs) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const [name, data] of Object.entries(contribs.candidates) as [string, any][]) {
        const cid = await getCandidateId(name, data.filer_id);
        await client.query(
          `INSERT INTO contributions (candidate_id, total_raised, contribution_count, unique_donors, avg_contribution, repeat_donor_amount, repeat_donor_count, repeat_donor_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (candidate_id) DO UPDATE SET
             total_raised = EXCLUDED.total_raised, contribution_count = EXCLUDED.contribution_count,
             unique_donors = EXCLUDED.unique_donors, avg_contribution = EXCLUDED.avg_contribution,
             repeat_donor_amount = EXCLUDED.repeat_donor_amount, repeat_donor_count = EXCLUDED.repeat_donor_count,
             repeat_donor_rate = EXCLUDED.repeat_donor_rate`,
          [cid, data.total_raised, data.contribution_count, data.unique_donors, data.avg_contribution, data.repeat_donor_amount, data.repeat_donor_count, data.repeat_donor_rate]
        );
        rowCount++;

        // By size
        for (const [bucket, amount] of Object.entries(data.by_size || {})) {
          const count = data.by_size_count?.[bucket] || 0;
          await client.query(
            `INSERT INTO contributions_by_size (candidate_id, size_bucket, amount, count)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (candidate_id, size_bucket) DO UPDATE SET amount = EXCLUDED.amount, count = EXCLUDED.count`,
            [cid, bucket, amount, count]
          );
          rowCount++;
        }

        // By type
        for (const [dtype, amount] of Object.entries(data.by_type || {})) {
          const count = data.by_type_count?.[dtype] || 0;
          await client.query(
            `INSERT INTO contributions_by_type (candidate_id, donor_type, amount, count)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (candidate_id, donor_type) DO UPDATE SET amount = EXCLUDED.amount, count = EXCLUDED.count`,
            [cid, dtype, amount, count]
          );
          rowCount++;
        }

        // Monthly
        for (const [month, amount] of Object.entries(data.contributions_by_month || {})) {
          await client.query(
            `INSERT INTO contributions_monthly (candidate_id, month, amount)
             VALUES ($1,$2,$3)
             ON CONFLICT (candidate_id, month) DO UPDATE SET amount = EXCLUDED.amount`,
            [cid, month, amount]
          );
          rowCount++;
        }

        // Top donors (Form 460) - no unique constraint, delete+reinsert
        await client.query(`DELETE FROM top_donors WHERE candidate_id = $1 AND source = 'form460'`, [cid]);
        for (const donor of data.top_donors || []) {
          await client.query(
            `INSERT INTO top_donors (candidate_id, source, donor_name, amount, donations)
             VALUES ($1,'form460',$2,$3,$4)`,
            [cid, donor.name, donor.amount, donor.donations]
          );
          rowCount++;
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 3. LATE CONTRIBUTIONS (S497 / campaign-finance.json) ---
  console.log("Importing campaign-finance.json (S497)...");
  const finance = readJSON("campaign-finance.json");
  if (finance) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const [name, data] of Object.entries(finance.candidates) as [string, any][]) {
        const cid = await getCandidateId(name, data.filer_id);
        await client.query(
          `INSERT INTO late_contributions (candidate_id, total_raised, donor_count, avg_donation)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (candidate_id) DO UPDATE SET
             total_raised = EXCLUDED.total_raised, donor_count = EXCLUDED.donor_count, avg_donation = EXCLUDED.avg_donation`,
          [cid, data.total_raised, data.donor_count, data.avg_donation]
        );
        rowCount++;

        // S497 top donors - delete+reinsert
        await client.query(`DELETE FROM top_donors WHERE candidate_id = $1 AND source = 's497'`, [cid]);
        for (const donor of data.top_donors || []) {
          await client.query(
            `INSERT INTO top_donors (candidate_id, source, donor_name, amount, employer, occupation, city, state)
             VALUES ($1,'s497',$2,$3,$4,$5,$6,$7)`,
            [cid, donor.name, donor.amount, donor.employer || null, donor.occupation || null, donor.city || null, donor.state || null]
          );
          rowCount++;
        }

        // By state
        for (const [state, amount] of Object.entries(data.by_state || {})) {
          await client.query(
            `INSERT INTO late_contribution_by_state (candidate_id, state, amount)
             VALUES ($1,$2,$3)
             ON CONFLICT (candidate_id, state) DO UPDATE SET amount = EXCLUDED.amount`,
            [cid, state, amount]
          );
          rowCount++;
        }

        // By occupation
        for (const [occupation, odata] of Object.entries(data.by_occupation || {}) as [string, any][]) {
          await client.query(
            `INSERT INTO late_contribution_by_occupation (candidate_id, occupation, count, amount)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (candidate_id, occupation) DO UPDATE SET count = EXCLUDED.count, amount = EXCLUDED.amount`,
            [cid, occupation, odata.count, odata.amount]
          );
          rowCount++;
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 4. SPENDING ---
  console.log("Importing campaign-spending.json...");
  const spending = readJSON("campaign-spending.json");
  if (spending) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const [name, data] of Object.entries(spending.candidates) as [string, any][]) {
        const cid = await getCandidateId(name, data.filer_id);
        await client.query(
          `INSERT INTO spending (candidate_id, total_spending, expenditure_count)
           VALUES ($1,$2,$3)
           ON CONFLICT (candidate_id) DO UPDATE SET
             total_spending = EXCLUDED.total_spending, expenditure_count = EXCLUDED.expenditure_count`,
          [cid, data.total_spending, data.expenditure_count]
        );
        rowCount++;

        // By category
        for (const [cat, amount] of Object.entries(data.by_category || {})) {
          await client.query(
            `INSERT INTO spending_by_category (candidate_id, category, amount)
             VALUES ($1,$2,$3)
             ON CONFLICT (candidate_id, category) DO UPDATE SET amount = EXCLUDED.amount`,
            [cid, cat, amount]
          );
          rowCount++;
        }

        // Top vendors - no unique constraint, delete+reinsert
        await client.query(`DELETE FROM top_vendors WHERE candidate_id = $1`, [cid]);
        for (const vendor of data.top_vendors || []) {
          if (vendor.name) {
            await client.query(
              `INSERT INTO top_vendors (candidate_id, vendor_name, amount) VALUES ($1,$2,$3)`,
              [cid, vendor.name, vendor.amount]
            );
            rowCount++;
          }
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 5. GEOGRAPHY ---
  console.log("Importing campaign-geography.json...");
  const geo = readJSON("campaign-geography.json");
  if (geo) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const [name, data] of Object.entries(geo.candidates) as [string, any][]) {
        const cid = await getCandidateId(name, data.filer_id);
        await client.query(
          `INSERT INTO geography (candidate_id, in_state_amount, out_of_state_amount, in_state_pct, diversity_score)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (candidate_id) DO UPDATE SET
             in_state_amount = EXCLUDED.in_state_amount, out_of_state_amount = EXCLUDED.out_of_state_amount,
             in_state_pct = EXCLUDED.in_state_pct, diversity_score = EXCLUDED.diversity_score`,
          [cid, data.in_state, data.out_of_state, data.in_state_pct, data.diversity_score]
        );
        rowCount++;

        // By region
        for (const [region, amount] of Object.entries(data.by_region || {})) {
          await client.query(
            `INSERT INTO geography_by_region (candidate_id, region, amount)
             VALUES ($1,$2,$3)
             ON CONFLICT (candidate_id, region) DO UPDATE SET amount = EXCLUDED.amount`,
            [cid, region, amount]
          );
          rowCount++;
        }

        // Top cities - no unique constraint, delete+reinsert
        await client.query(`DELETE FROM geography_top_cities WHERE candidate_id = $1`, [cid]);
        for (const city of data.top_cities || []) {
          await client.query(
            `INSERT INTO geography_top_cities (candidate_id, city, amount) VALUES ($1,$2,$3)`,
            [cid, city.city, city.amount]
          );
          rowCount++;
        }

        // Top states - no unique constraint, delete+reinsert
        await client.query(`DELETE FROM geography_top_states WHERE candidate_id = $1`, [cid]);
        for (const state of data.top_states || []) {
          await client.query(
            `INSERT INTO geography_top_states (candidate_id, state, amount) VALUES ($1,$2,$3)`,
            [cid, state.state, state.amount]
          );
          rowCount++;
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 6. DEBTS ---
  console.log("Importing campaign-debts.json...");
  const debts = readJSON("campaign-debts.json");
  if (debts) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const [name, data] of Object.entries(debts.candidates) as [string, any][]) {
        const cid = await getCandidateId(name, data.filer_id);
        await client.query(
          `INSERT INTO debts (candidate_id, total_debt, total_loans, self_loans)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (candidate_id) DO UPDATE SET
             total_debt = EXCLUDED.total_debt, total_loans = EXCLUDED.total_loans, self_loans = EXCLUDED.self_loans`,
          [cid, data.total_debt, data.total_loans, data.self_loans]
        );
        rowCount++;

        // Top creditors - no unique constraint, delete+reinsert
        await client.query(`DELETE FROM top_creditors WHERE candidate_id = $1`, [cid]);
        for (const creditor of data.top_creditors || []) {
          await client.query(
            `INSERT INTO top_creditors (candidate_id, name, amount) VALUES ($1,$2,$3)`,
            [cid, creditor.creditor, creditor.amount]
          );
          rowCount++;
        }

        // Top lenders - no unique constraint, delete+reinsert
        await client.query(`DELETE FROM top_lenders WHERE candidate_id = $1`, [cid]);
        for (const lender of data.top_lenders || []) {
          await client.query(
            `INSERT INTO top_lenders (candidate_id, name, amount) VALUES ($1,$2,$3)`,
            [cid, lender.lender, lender.amount]
          );
          rowCount++;
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 7. CAMPAIGN TIMELINE ---
  console.log("Importing campaign-timeline.json...");
  const timeline = readJSON("campaign-timeline.json");
  if (timeline) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const [name, data] of Object.entries(timeline.candidates) as [string, any][]) {
        const cid = await getCandidateId(name);
        for (const m of data.monthly_data || []) {
          await client.query(
            `INSERT INTO campaign_timeline (candidate_id, month, contributions, spending, net, cumulative_raised, cumulative_spent, mom_growth, trail_3m_contrib)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (candidate_id, month) DO UPDATE SET
               contributions = EXCLUDED.contributions, spending = EXCLUDED.spending, net = EXCLUDED.net,
               cumulative_raised = EXCLUDED.cumulative_raised, cumulative_spent = EXCLUDED.cumulative_spent,
               mom_growth = EXCLUDED.mom_growth, trail_3m_contrib = EXCLUDED.trail_3m_contrib`,
            [cid, m.month, m.contributions, m.spending, m.net, m.cumulative_raised, m.cumulative_spent, m.mom_growth ?? null, m.trail_3m_contrib ?? null]
          );
          rowCount++;
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 8. CAMPAIGN FILINGS ---
  console.log("Importing campaign-filings.json...");
  const filings = readJSON("campaign-filings.json");
  if (filings) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const [name, data] of Object.entries(filings.candidates) as [string, any][]) {
        const cid = await getCandidateId(name);
        // Delete+reinsert (no unique constraint on filing_id)
        await client.query(`DELETE FROM campaign_filings WHERE candidate_id = $1`, [cid]);
        for (const f of data.filings || []) {
          await client.query(
            `INSERT INTO campaign_filings (candidate_id, filing_id, form_type, thru_date, rpt_date, cash_on_hand, receipts, expenditures)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [cid, f.filing_id, f.form_type, f.thru_date || null, f.rpt_date || null, f.cash_on_hand, f.period_receipts, f.period_expenditures]
          );
          rowCount++;
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 9. SOCIAL STATS ---
  console.log("Importing social-stats.json...");
  const social = readJSON("social-stats.json");
  if (social) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const [name, data] of Object.entries(social.candidates) as [string, any][]) {
        const isPrimary = !["Alex Padilla"].includes(name);
        const cid = await getCandidateId(name, undefined, data.party, isPrimary);

        // Accounts
        for (const [platform, account] of Object.entries(data.accounts || {}) as [string, any][]) {
          if (account) {
            await client.query(
              `INSERT INTO social_accounts (candidate_id, platform, handle, url)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (candidate_id, platform) DO UPDATE SET handle = EXCLUDED.handle, url = EXCLUDED.url`,
              [cid, platform, account.handle, account.url]
            );
            rowCount++;
          }
        }

        // History
        for (const snapshot of data.history || []) {
          for (const platform of ["instagram", "tiktok", "youtube", "x"]) {
            if (snapshot[platform] !== null && snapshot[platform] !== undefined) {
              await client.query(
                `INSERT INTO social_follower_history (candidate_id, platform, date, followers)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (candidate_id, platform, date) DO UPDATE SET followers = EXCLUDED.followers`,
                [cid, platform, snapshot.date, snapshot[platform]]
              );
              rowCount++;
            }
          }
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 10. GOOGLE TRENDS ---
  console.log("Importing google-trends.json...");
  const trends = readJSON("google-trends.json");
  if (trends) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const [name, data] of Object.entries(trends.candidates) as [string, any][]) {
        const cid = await getCandidateId(name);
        for (const point of data.data || []) {
          const date = new Date(point.date);
          if (!isNaN(date.getTime())) {
            const dateStr = date.toISOString().split("T")[0];
            await client.query(
              `INSERT INTO google_trends (candidate_id, date, search_interest)
               VALUES ($1,$2,$3)
               ON CONFLICT (candidate_id, date) DO UPDATE SET search_interest = EXCLUDED.search_interest`,
              [cid, dateStr, point.value]
            );
            rowCount++;
          }
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 11. WIKIPEDIA PAGEVIEWS ---
  console.log("Importing wiki-pageviews.json...");
  const wiki = readJSON("wiki-pageviews.json");
  if (wiki) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const [name, data] of Object.entries(wiki.candidates) as [string, any][]) {
        const cid = await getCandidateId(name);
        for (const point of data.daily || []) {
          await client.query(
            `INSERT INTO wiki_pageviews (candidate_id, date, views)
             VALUES ($1, $2, $3)
             ON CONFLICT (candidate_id, date) DO UPDATE SET views = EXCLUDED.views`,
            [cid, point.date, point.views]
          );
          rowCount++;
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 12. TIKTOK MENTIONS ---
  console.log("Importing monitor-data.json (TikTok mentions)...");
  const monitor = readJSON("monitor-data.json");
  if (monitor) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const post of monitor.results || []) {
        await client.query(
          `INSERT INTO tiktok_mentions (video_id, url, thumbnail, description, views, likes, comments, shares, engagement, created_at, author_username, author_nickname, sentiment)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (video_id) DO UPDATE SET
             views = EXCLUDED.views, likes = EXCLUDED.likes, comments = EXCLUDED.comments,
             shares = EXCLUDED.shares, engagement = EXCLUDED.engagement, sentiment = EXCLUDED.sentiment`,
          [post.id, post.url, post.thumbnail, post.description, post.views, post.likes, post.comments, post.shares, post.engagement, post.createdAt, post.author?.username, post.author?.nickname, post.sentiment]
        );
        rowCount++;
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 13. TIKTOK CONTENT ---
  console.log("Importing content-data.json (TikTok content)...");
  const content = readJSON("content-data.json");
  if (content) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const post of content.topContent || []) {
        if (post.candidate) {
          const cid = await getCandidateId(post.candidate);
          await client.query(
            `INSERT INTO tiktok_content (candidate_id, video_id, url, thumbnail, description, views, likes, comments, shares, engagement, created_at, author_username, author_nickname)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT (candidate_id, video_id) DO UPDATE SET
               views = EXCLUDED.views, likes = EXCLUDED.likes, comments = EXCLUDED.comments,
               shares = EXCLUDED.shares, engagement = EXCLUDED.engagement`,
            [cid, post.id, post.url, post.thumbnail, post.description, post.views, post.likes, post.comments, post.shares, post.engagement, post.createdAt, post.author?.username, post.author?.nickname]
          );
          rowCount++;
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 14. YOUTUBE ---
  console.log("Importing youtube-content.json...");
  const yt = readJSON("youtube-content.json");
  if (yt) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;
      for (const entry of yt.candidates || []) {
        const cid = await getCandidateId(entry.candidate, undefined, entry.party);

        // Channel (aggregated across all channels for this candidate)
        if (entry.channelStats) {
          const cs = entry.channelStats;
          const handle = entry.handles?.join(" + ") || entry.channelInfo?.handle;
          await client.query(
            `INSERT INTO youtube_channels (candidate_id, channel_id, handle, url, bio, verified, avatar, subscribers, total_videos)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (candidate_id) DO UPDATE SET
               handle = EXCLUDED.handle,
               subscribers = EXCLUDED.subscribers,
               total_videos = EXCLUDED.total_videos,
               bio = EXCLUDED.bio,
               verified = EXCLUDED.verified`,
            [cid, entry.channelInfo?.channelId, handle, cs.url, cs.bio, cs.verified, cs.avatar, cs.subscribers, cs.totalVideos]
          );
          rowCount++;
        }

        // Videos
        for (const video of entry.recentVideos || []) {
          await client.query(
            `INSERT INTO youtube_videos (candidate_id, video_id, url, title, description, thumbnail, published_at, views, likes, comments, engagement, engagement_rate)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (candidate_id, video_id) DO UPDATE SET
               views = EXCLUDED.views,
               likes = EXCLUDED.likes,
               comments = EXCLUDED.comments,
               engagement = EXCLUDED.engagement,
               engagement_rate = EXCLUDED.engagement_rate`,
            [cid, video.id, video.url, video.title, video.description, video.thumbnail, video.publishedAt, video.views, video.likes, video.comments, video.engagement, video.engagementRate]
          );
          rowCount++;

          // Track video stats history (snapshot per day)
          await client.query(
            `INSERT INTO youtube_video_history (candidate_id, video_id, date, views, likes, comments)
             VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)
             ON CONFLICT (candidate_id, video_id, date) DO UPDATE SET
               views = EXCLUDED.views, likes = EXCLUDED.likes, comments = EXCLUDED.comments`,
            [cid, video.id, video.views, video.likes, video.comments]
          );
        }

        // Track subscriber history (snapshot per day)
        if (entry.channelStats?.subscribers > 0) {
          await client.query(
            `INSERT INTO youtube_subscriber_history (candidate_id, date, subscribers, total_videos)
             VALUES ($1, CURRENT_DATE, $2, $3)
             ON CONFLICT (candidate_id, date) DO UPDATE SET
               subscribers = EXCLUDED.subscribers, total_videos = EXCLUDED.total_videos`,
            [cid, entry.channelStats.subscribers, entry.channelStats.totalVideos]
          );
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 15. INTEL ANALYSIS ---
  console.log("Importing intel-analysis.json...");
  const intel = readJSON("intel-analysis.json");
  if (intel) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;

      // Observations - delete+reinsert (no unique constraint)
      await client.query(`DELETE FROM intel_observations`);
      for (const obs of intel.observations || []) {
        await client.query(
          `INSERT INTO intel_observations (category, text) VALUES ('observation', $1)`,
          [obs]
        );
        rowCount++;
      }
      for (const note of intel.regional_notes || []) {
        await client.query(
          `INSERT INTO intel_observations (category, text) VALUES ('regional_note', $1)`,
          [note]
        );
        rowCount++;
      }

      // Snapshots
      for (const [name, data] of Object.entries(intel.snapshots || {}) as [string, any][]) {
        const cid = await getCandidateId(name);
        await client.query(
          `INSERT INTO intel_snapshots (candidate_id, has_form_460, cash_on_hand, total_raised_460, total_spent_460, s497_raised, s497_donors, s497_pac_pct, rcpt_total, unique_donors, repeat_rate, small_dollar_pct, committee_transfers, ca_pct, total_debt, burn_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT (candidate_id) DO UPDATE SET
             has_form_460 = EXCLUDED.has_form_460, cash_on_hand = EXCLUDED.cash_on_hand,
             total_raised_460 = EXCLUDED.total_raised_460, total_spent_460 = EXCLUDED.total_spent_460,
             s497_raised = EXCLUDED.s497_raised, s497_donors = EXCLUDED.s497_donors,
             s497_pac_pct = EXCLUDED.s497_pac_pct, rcpt_total = EXCLUDED.rcpt_total,
             unique_donors = EXCLUDED.unique_donors, repeat_rate = EXCLUDED.repeat_rate,
             small_dollar_pct = EXCLUDED.small_dollar_pct, committee_transfers = EXCLUDED.committee_transfers,
             ca_pct = EXCLUDED.ca_pct, total_debt = EXCLUDED.total_debt, burn_rate = EXCLUDED.burn_rate`,
          [cid, data.has_form_460, data.cash_on_hand, data.total_raised_460, data.total_spent_460, data.s497_raised, data.s497_donors, data.s497_pac_pct, data.rcpt_total, data.unique_donors, data.repeat_rate, data.small_dollar_pct, data.committee_transfers, data.ca_pct, data.total_debt, data.burn_rate]
        );
        rowCount++;
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 16. INDEPENDENT EXPENDITURES ---
  console.log("Importing independent-expenditures.json...");
  const ie = readJSON("independent-expenditures.json");
  if (ie?.data?.by_candidate) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;

      // Clear existing IE data
      await client.query(`DELETE FROM independent_expenditures`);
      await client.query(`DELETE FROM ie_committees`);

      for (const [candidateName, data] of Object.entries(ie.data.by_candidate) as [string, any][]) {
        // Try to match candidate name to our candidates table
        const cidRes = await client.query(
          "SELECT id FROM candidates WHERE name = $1",
          [candidateName]
        );
        const cid = cidRes.rows[0]?.id || null;

        // IE Summary (upsert)
        if (cid) {
          await client.query(
            `INSERT INTO ie_summary (candidate_id, total_support, total_oppose, net_support, committee_count)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (candidate_id) DO UPDATE SET
               total_support = EXCLUDED.total_support, total_oppose = EXCLUDED.total_oppose,
               net_support = EXCLUDED.net_support, committee_count = EXCLUDED.committee_count`,
            [cid, data.total_support, data.total_oppose, data.net_support, data.committee_count]
          );
          rowCount++;

          // IE Committees
          for (const committee of data.top_committees || []) {
            await client.query(
              `INSERT INTO ie_committees (candidate_id, committee_name, support, oppose, total)
               VALUES ($1,$2,$3,$4,$5)`,
              [cid, committee.committee_name, committee.support, committee.oppose, committee.total]
            );
            rowCount++;
          }

          // Individual expenditures (top 20 per candidate)
          for (const exp of data.top_expenditures || []) {
            await client.query(
              `INSERT INTO independent_expenditures (candidate_id, committee_name, support_oppose, amount, date, description)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [cid, exp.committee, exp.support_oppose, exp.amount, exp.date || null, exp.description]
            );
            rowCount++;
          }
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- 17. POLLS ---
  console.log("Importing polls.json...");
  const polls = readJSON("polls.json");
  if (polls?.polls) {
    try {
      await client.query("BEGIN");
      let rowCount = 0;

      for (const poll of polls.polls) {
        // Upsert poll (unique on pollster + end_date)
        const pollRes = await client.query(
          `INSERT INTO polls (pollster, start_date, end_date, sample_size, population, margin_of_error, source_url, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (pollster, end_date) DO UPDATE SET
             start_date = EXCLUDED.start_date, sample_size = EXCLUDED.sample_size,
             population = EXCLUDED.population, margin_of_error = EXCLUDED.margin_of_error,
             source_url = EXCLUDED.source_url, source = EXCLUDED.source
           RETURNING id`,
          [poll.pollster, poll.start_date, poll.end_date, poll.sample_size || null, poll.population || null, poll.margin_of_error || null, poll.source_url || null, poll.source || null]
        );
        const pollId = pollRes.rows[0].id;
        rowCount++;

        // Delete existing results for this poll and reinsert
        await client.query(`DELETE FROM poll_results WHERE poll_id = $1`, [pollId]);
        for (const result of poll.results || []) {
          // Try to match candidate
          const cidRes = await client.query(
            "SELECT id FROM candidates WHERE name = $1",
            [result.candidate_name]
          );
          const cid = cidRes.rows[0]?.id || null;

          await client.query(
            `INSERT INTO poll_results (poll_id, candidate_id, candidate_name, percentage, party)
             VALUES ($1,$2,$3,$4,$5)`,
            [pollId, cid, result.candidate_name, result.percentage, result.party || null]
          );
          rowCount++;
        }
      }
      await client.query("COMMIT");
      console.log(`  Done (${rowCount} rows upserted)`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("  Failed:", e);
    }
  }

  // --- Fix is_primary for specific candidates ---
  await client.query(
    `UPDATE candidates SET is_primary = true WHERE name IN ('Matt Mahan')`
  );
  // Rick Caruso dropped out
  await client.query(
    `UPDATE candidates SET is_primary = false WHERE name = 'Rick Caruso'`
  );

  // Summary
  const counts = await client.query(`
    SELECT 'candidates' as t, count(*) FROM candidates UNION ALL
    SELECT 'campaign_summary', count(*) FROM campaign_summary UNION ALL
    SELECT 'contributions', count(*) FROM contributions UNION ALL
    SELECT 'contributions_by_size', count(*) FROM contributions_by_size UNION ALL
    SELECT 'contributions_by_type', count(*) FROM contributions_by_type UNION ALL
    SELECT 'contributions_monthly', count(*) FROM contributions_monthly UNION ALL
    SELECT 'top_donors', count(*) FROM top_donors UNION ALL
    SELECT 'spending', count(*) FROM spending UNION ALL
    SELECT 'spending_by_category', count(*) FROM spending_by_category UNION ALL
    SELECT 'top_vendors', count(*) FROM top_vendors UNION ALL
    SELECT 'geography', count(*) FROM geography UNION ALL
    SELECT 'geography_by_region', count(*) FROM geography_by_region UNION ALL
    SELECT 'geography_top_cities', count(*) FROM geography_top_cities UNION ALL
    SELECT 'geography_top_states', count(*) FROM geography_top_states UNION ALL
    SELECT 'debts', count(*) FROM debts UNION ALL
    SELECT 'top_creditors', count(*) FROM top_creditors UNION ALL
    SELECT 'top_lenders', count(*) FROM top_lenders UNION ALL
    SELECT 'campaign_timeline', count(*) FROM campaign_timeline UNION ALL
    SELECT 'campaign_filings', count(*) FROM campaign_filings UNION ALL
    SELECT 'late_contributions', count(*) FROM late_contributions UNION ALL
    SELECT 'late_contribution_by_state', count(*) FROM late_contribution_by_state UNION ALL
    SELECT 'late_contribution_by_occupation', count(*) FROM late_contribution_by_occupation UNION ALL
    SELECT 'social_accounts', count(*) FROM social_accounts UNION ALL
    SELECT 'social_follower_history', count(*) FROM social_follower_history UNION ALL
    SELECT 'google_trends', count(*) FROM google_trends UNION ALL
    SELECT 'wiki_pageviews', count(*) FROM wiki_pageviews UNION ALL
    SELECT 'tiktok_mentions', count(*) FROM tiktok_mentions UNION ALL
    SELECT 'tiktok_content', count(*) FROM tiktok_content UNION ALL
    SELECT 'youtube_channels', count(*) FROM youtube_channels UNION ALL
    SELECT 'youtube_videos', count(*) FROM youtube_videos UNION ALL
    SELECT 'youtube_subscriber_history', count(*) FROM youtube_subscriber_history UNION ALL
    SELECT 'youtube_video_history', count(*) FROM youtube_video_history UNION ALL
    SELECT 'intel_snapshots', count(*) FROM intel_snapshots UNION ALL
    SELECT 'intel_observations', count(*) FROM intel_observations UNION ALL
    SELECT 'independent_expenditures', count(*) FROM independent_expenditures UNION ALL
    SELECT 'ie_summary', count(*) FROM ie_summary UNION ALL
    SELECT 'ie_committees', count(*) FROM ie_committees UNION ALL
    SELECT 'polls', count(*) FROM polls UNION ALL
    SELECT 'poll_results', count(*) FROM poll_results
  `);

  console.log("\n=== Database Summary ===");
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

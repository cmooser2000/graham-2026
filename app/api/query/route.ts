import { query } from "@/lib/db";
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

let schemaCache: string | null = null;
function getSchema(): string {
  if (!schemaCache) {
    schemaCache = readFileSync(join(process.cwd(), "scripts/data-dictionary.md"), "utf-8");
  }
  return schemaCache;
}

const EXAMPLE_QUERIES = `
-- FINANCE: Who has the most cash on hand?
SELECT name, party, cash_on_hand, total_receipts, s497_total_raised FROM candidate_overview ORDER BY cash_on_hand DESC;

-- FINANCE: Top 10 donors across all candidates
SELECT c.name AS candidate, td.donor_name, td.amount, td.source, td.occupation, td.city, td.state FROM top_donors td JOIN candidates c ON c.id = td.candidate_id ORDER BY td.amount DESC LIMIT 10;

-- FINANCE: Which candidate has the highest burn rate?
SELECT name, burn_rate, cash_on_hand, runway_months FROM candidate_overview WHERE burn_rate > 0 ORDER BY burn_rate DESC;

-- FINANCE: Compare small-dollar donor percentages
SELECT c.name, cbs.amount, cbs.count, co.total_raised, ROUND(cbs.amount / NULLIF(co.total_raised, 0) * 100, 1) AS small_dollar_pct FROM contributions_by_size cbs JOIN candidates c ON c.id = cbs.candidate_id JOIN contributions co ON co.candidate_id = cbs.candidate_id WHERE cbs.size_bucket = 'small' ORDER BY small_dollar_pct DESC;

-- FINANCE: Total spending by category across all candidates
SELECT sbc.category, SUM(sbc.amount) AS total, COUNT(*) AS candidates FROM spending_by_category sbc GROUP BY sbc.category ORDER BY total DESC;

-- FINANCE: Who received the most from out-of-state donors?
SELECT name, out_of_state_amount, in_state_amount, ROUND(in_state_pct * 100, 1) AS in_state_pct FROM candidate_overview ORDER BY out_of_state_amount DESC;

-- FINANCE: Repeat donor rates
SELECT c.name, ROUND(co.repeat_donor_rate * 100, 1) AS repeat_pct, co.repeat_donor_count, co.unique_donors FROM contributions co JOIN candidates c ON c.id = co.candidate_id WHERE co.repeat_donor_rate > 0 ORDER BY co.repeat_donor_rate DESC;

-- FINANCE: Campaign timeline for a specific candidate
SELECT c.name, ct.month, ct.contributions, ct.spending, ct.net, ct.cumulative_raised FROM campaign_timeline ct JOIN candidates c ON c.id = ct.candidate_id WHERE c.name = 'Katie Porter' ORDER BY ct.month;

-- FINANCE: Monthly fundraising comparison across candidates
SELECT c.name, cm.month, cm.amount FROM contributions_monthly cm JOIN candidates c ON c.id = cm.candidate_id ORDER BY cm.month, cm.amount DESC;

-- FINANCE: Who has the most debt?
SELECT c.name, d.total_debt, d.total_loans, d.self_loans FROM debts d JOIN candidates c ON c.id = d.candidate_id WHERE d.total_debt > 0 ORDER BY d.total_debt DESC;

-- FINANCE: Contribution breakdown by donor type
SELECT c.name, cbt.donor_type, cbt.amount, cbt.count FROM contributions_by_type cbt JOIN candidates c ON c.id = cbt.candidate_id ORDER BY c.name, cbt.amount DESC;

-- FINANCE: Top cities for fundraising
SELECT c.name, gtc.city, gtc.amount FROM geography_top_cities gtc JOIN candidates c ON c.id = gtc.candidate_id ORDER BY gtc.amount DESC LIMIT 20;

-- FINANCE: Late S497 contributions by candidate
SELECT c.name, lc.total_raised, lc.donor_count, ROUND(lc.avg_donation) AS avg_donation FROM late_contributions lc JOIN candidates c ON c.id = lc.candidate_id ORDER BY lc.total_raised DESC;

-- FINANCE: Campaign filings list
SELECT c.name, cf.form_type, cf.thru_date, cf.rpt_date, cf.cash_on_hand, cf.receipts, cf.expenditures FROM campaign_filings cf JOIN candidates c ON c.id = cf.candidate_id ORDER BY cf.rpt_date DESC LIMIT 20;

-- FINANCE: Top vendors across all candidates
SELECT c.name AS candidate, tv.vendor_name, tv.amount FROM top_vendors tv JOIN candidates c ON c.id = tv.candidate_id ORDER BY tv.amount DESC LIMIT 15;

-- YOUTUBE: Which candidate has the most YouTube subscribers?
SELECT c.name, yc.handle, yc.subscribers, yc.total_videos, yc.verified FROM youtube_channels yc JOIN candidates c ON c.id = yc.candidate_id ORDER BY yc.subscribers DESC;

-- YOUTUBE: Most viewed videos across all candidates
SELECT c.name, yv.title, yv.views, yv.likes, yv.comments, ROUND(yv.engagement_rate * 100, 2) AS engagement_pct, yv.published_at::date FROM youtube_videos yv JOIN candidates c ON c.id = yv.candidate_id ORDER BY yv.views DESC LIMIT 15;

-- YOUTUBE: Subscriber growth over the last 30 days
SELECT c.name, ysh.date, ysh.subscribers FROM youtube_subscriber_history ysh JOIN candidates c ON c.id = ysh.candidate_id WHERE ysh.date >= CURRENT_DATE - INTERVAL '30 days' ORDER BY ysh.date, c.name;

-- YOUTUBE: Videos with highest engagement rate
SELECT c.name, yv.title, yv.views, yv.likes, yv.comments, ROUND(yv.engagement_rate * 100, 2) AS engagement_pct FROM youtube_videos yv JOIN candidates c ON c.id = yv.candidate_id WHERE yv.views > 100 ORDER BY yv.engagement_rate DESC LIMIT 10;

-- YOUTUBE: Video view velocity (how fast videos gained views)
SELECT c.name, yv.title, yvh.date, yvh.views FROM youtube_video_history yvh JOIN youtube_videos yv ON yv.candidate_id = yvh.candidate_id AND yv.video_id = yvh.video_id JOIN candidates c ON c.id = yvh.candidate_id ORDER BY yvh.date DESC, yvh.views DESC LIMIT 50;

-- TRENDS: Google Trends interest over the last 30 days
SELECT c.name, gt.date, gt.search_interest FROM google_trends gt JOIN candidates c ON c.id = gt.candidate_id WHERE gt.date >= (SELECT MAX(date) - INTERVAL '30 days' FROM google_trends) ORDER BY gt.date DESC, gt.search_interest DESC;

-- TRENDS: Average search interest by candidate (last 7 days)
SELECT c.name, ROUND(AVG(gt.search_interest), 1) AS avg_interest, MAX(gt.search_interest) AS peak FROM google_trends gt JOIN candidates c ON c.id = gt.candidate_id WHERE gt.date >= (SELECT MAX(date) - INTERVAL '7 days' FROM google_trends) GROUP BY c.name ORDER BY avg_interest DESC;

-- WIKI: Wikipedia pageviews last 30 days
SELECT c.name, wp.date, wp.views FROM wiki_pageviews wp JOIN candidates c ON c.id = wp.candidate_id WHERE wp.date >= (SELECT MAX(date) - INTERVAL '30 days' FROM wiki_pageviews) ORDER BY wp.date DESC, wp.views DESC;

-- WIKI: Total Wikipedia views by candidate (NOTE: cast AVG to numeric before ROUND)
SELECT c.name, SUM(wp.views) AS total_views, ROUND(AVG(wp.views)::numeric) AS avg_daily, MAX(wp.views) AS peak_day FROM wiki_pageviews wp JOIN candidates c ON c.id = wp.candidate_id GROUP BY c.name ORDER BY total_views DESC;

-- WIKI: Wikipedia spike detection — days where views > 3x the candidate's median (NOTE: cast PERCENTILE_CONT to numeric)
SELECT c.name, wp.date, wp.views FROM wiki_pageviews wp JOIN candidates c ON c.id = wp.candidate_id WHERE wp.views > (SELECT (3 * PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wp2.views))::numeric FROM wiki_pageviews wp2 WHERE wp2.candidate_id = wp.candidate_id) ORDER BY wp.views DESC LIMIT 20;

-- SOCIAL: Social media reach by platform
SELECT * FROM candidate_social_reach ORDER BY latest_followers DESC NULLS LAST;

-- OVERVIEW: Full candidate comparison dashboard
SELECT name, party, cash_on_hand, total_receipts, total_expenditures, s497_total_raised, unique_donors, ROUND(avg_contribution) AS avg_donation, ROUND(burn_rate * 100, 1) AS burn_pct, ROUND(in_state_pct * 100, 1) AS in_state_pct, total_debt FROM candidate_overview ORDER BY cash_on_hand DESC;

-- INTEL: Analyst observations
SELECT category, text FROM intel_observations ORDER BY category;

-- IE: How much outside money supports each candidate?
SELECT c.name, ie.total_support, ie.total_oppose, ie.net_support, ie.committee_count FROM ie_summary ie JOIN candidates c ON c.id = ie.candidate_id ORDER BY ie.total_support + ie.total_oppose DESC;

-- IE: Which PACs are spending the most on the governor's race?
SELECT c.name AS candidate, iec.committee_name, iec.support, iec.oppose, iec.total FROM ie_committees iec JOIN candidates c ON c.id = iec.candidate_id ORDER BY iec.total DESC LIMIT 15;

-- IE: Independent expenditures against a specific candidate
SELECT c.name, iex.committee_name, iex.support_oppose, iex.amount, iex.date, iex.description FROM independent_expenditures iex JOIN candidates c ON c.id = iex.candidate_id WHERE iex.support_oppose = 'O' ORDER BY iex.amount DESC LIMIT 20;

-- IE: Net outside money advantage (support minus opposition)
SELECT c.name, ie.total_support, ie.total_oppose, ie.net_support FROM ie_summary ie JOIN candidates c ON c.id = ie.candidate_id ORDER BY ie.net_support DESC;

-- POLLS: Latest polling numbers
SELECT p.pollster, p.end_date, p.sample_size, p.population, pr.candidate_name, pr.percentage, pr.party FROM polls p JOIN poll_results pr ON pr.poll_id = p.id ORDER BY p.end_date DESC, pr.percentage DESC LIMIT 30;

-- POLLS: Who is leading in the polls?
SELECT pr.candidate_name, pr.party, ROUND(AVG(pr.percentage)::numeric, 1) AS avg_pct, COUNT(*) AS poll_count FROM poll_results pr JOIN polls p ON p.id = pr.poll_id GROUP BY pr.candidate_name, pr.party ORDER BY avg_pct DESC;

-- POLLS: Poll trends over time for a candidate
SELECT p.pollster, p.end_date, pr.percentage FROM polls p JOIN poll_results pr ON pr.poll_id = p.id WHERE pr.candidate_name = 'Eric Swalwell' ORDER BY p.end_date;

-- POLLS: Compare poll average vs prediction market odds (NOTE: prediction market odds are NOT in database, explain this)
-- Prediction market data is fetched live and not stored in SQL. Use poll averages for comparison:
SELECT pr.candidate_name, ROUND(AVG(pr.percentage)::numeric, 1) AS poll_avg FROM poll_results pr JOIN polls p ON p.id = pr.poll_id GROUP BY pr.candidate_name ORDER BY poll_avg DESC;
`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const question = body.question;

  if (!question || typeof question !== "string") {
    return new Response(
      `data: ${JSON.stringify({ type: "error", error: "Missing question" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.cagov_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", error: "ANTHROPIC_API_KEY not configured" })}\n\n`,
      { status: 500, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      // Phase 1: Generate SQL
      const sqlPrompt = `You are a SQL query generator for a PostgreSQL database tracking the California 2026 Governor's race. Given a natural language question, generate a single SELECT query.

You have access to campaign finance data (Form 460 + S497 filings), independent expenditures (Form 496 — outside money for/against candidates), polling data, YouTube analytics, Google Trends, Wikipedia pageviews, geographic donor breakdowns, spending by category, debt/loans, and analyst intel observations. Prediction market odds (Polymarket, Kalshi) are NOT in the database.

DATA DICTIONARY (all tables, columns, types, and allowed values):
${getSchema()}

EXAMPLE QUERIES (use these as patterns):
${EXAMPLE_QUERIES}

RULES:
- Only generate SELECT statements. Never INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, or TRUNCATE.
- Always JOIN with candidates table to include candidate names when the query involves candidate data.
- Use LIMIT to prevent huge result sets (max 100 rows unless asked for all).
- Return ONLY the SQL query, no explanation, no markdown fences.
- Use the views candidate_overview and candidate_social_reach when they simplify the query.
- For time series queries, use relative date filters like: WHERE date >= (SELECT MAX(date) - INTERVAL '30 days' FROM table_name)
- Format numbers nicely with ROUND() where appropriate.
- For percentage columns stored as decimals (0-1), multiply by 100 for display.
- When using ROUND() on computed values (e.g., AVG, ratios), cast to NUMERIC first: ROUND(AVG(col)::numeric, 1). PostgreSQL ROUND(double precision, int) does not exist.
- If the user asks about something not in the database (e.g., prediction market odds, polling), explain that in a SQL comment and return the closest available data.

Question: ${question}`;

      let sql = "";
      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1024,
          messages: [{ role: "user", content: sqlPrompt }],
        });

        const sqlRaw = (response.content[0] as { type: string; text: string }).text.trim();
        sql = sqlRaw.replace(/^```sql?\n?/i, "").replace(/\n?```$/i, "").trim();

        // Validate: must start with SELECT or WITH (CTEs)
        if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
          send({ type: "error", error: "Generated query is not a SELECT statement", sql });
          controller.close();
          return;
        }

        // Block dangerous keywords
        for (const keyword of ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE"]) {
          const re = new RegExp(`\\b${keyword}\\b`, "i");
          if (re.test(sql)) {
            send({ type: "error", error: `Blocked: query contains ${keyword}`, sql });
            controller.close();
            return;
          }
        }

        // Execute query
        await query(`SET statement_timeout = '5000'`);
        const result = await query(sql);

        const columns = result.fields?.map((f: { name: string }) => f.name) || [];
        const rows = result.rows || [];

        // Send data event
        send({
          type: "data",
          question,
          sql,
          columns,
          rows,
          rowCount: rows.length,
        });

        // Phase 2: Stream narrative answer
        const dataPreview = JSON.stringify(rows.slice(0, 25), null, 2);
        const narratePrompt = `You are a data analyst for a California 2026 Governor's race tracking dashboard. The user asked a question and we ran a SQL query. Narrate the results concisely.

Question: ${question}
SQL: ${sql}
Columns: ${columns.join(", ")}
Row count: ${rows.length}
Data (first ${Math.min(rows.length, 25)} rows):
${dataPreview}

Instructions:
- Answer the question directly using specific numbers from the data.
- Be concise — 2-4 sentences for simple queries, up to a short paragraph for complex ones.
- Use bold (**text**) for candidate names and key figures.
- Don't repeat the question or say "based on the data". Jump straight to the answer.
- Format large numbers with commas for readability.
- If the data reveals interesting comparisons or outliers, mention them briefly.`;

        const narrateStream = client.messages.stream({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 512,
          messages: [{ role: "user", content: narratePrompt }],
        });

        for await (const event of narrateStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ type: "text", content: event.delta.text });
          }
        }

        send({ type: "done" });
        controller.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Query failed";
        send({ type: "error", error: message, sql: sql || undefined });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

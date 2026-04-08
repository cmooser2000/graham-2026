import { query } from "@/lib/db";
import { NextResponse, NextRequest } from "next/server";

// Column definitions for each dataset
const COLUMNS: Record<string, { key: string; label: string; type: string; sortable?: boolean; align?: string }[]> = {
  summary: [
    { key: "name", label: "Candidate", type: "string", sortable: true },
    { key: "party", label: "Party", type: "string", sortable: true },
    { key: "cash_on_hand", label: "Cash on Hand", type: "currency", sortable: true, align: "right" },
    { key: "total_receipts", label: "Receipts", type: "currency", sortable: true, align: "right" },
    { key: "total_expenditures", label: "Expenditures", type: "currency", sortable: true, align: "right" },
    { key: "burn_rate", label: "Burn Rate", type: "number", sortable: true, align: "right" },
    { key: "runway_months", label: "Runway (mo)", type: "number", sortable: true, align: "right" },
    { key: "s497_total_raised", label: "S497 Raised", type: "currency", sortable: true, align: "right" },
    { key: "unique_donors", label: "Donors", type: "number", sortable: true, align: "right" },
    { key: "in_state_pct", label: "In-State %", type: "number", sortable: true, align: "right" },
  ],
  contributions: [
    { key: "name", label: "Candidate", type: "string", sortable: true },
    { key: "total_raised", label: "Total Raised", type: "currency", sortable: true, align: "right" },
    { key: "contribution_count", label: "Contributions", type: "number", sortable: true, align: "right" },
    { key: "unique_donors", label: "Donors", type: "number", sortable: true, align: "right" },
    { key: "avg_contribution", label: "Avg Donation", type: "currency", sortable: true, align: "right" },
    { key: "repeat_donor_rate", label: "Repeat Rate", type: "number", sortable: true, align: "right" },
  ],
  spending: [
    { key: "name", label: "Candidate", type: "string", sortable: true },
    { key: "total_spending", label: "Total Spending", type: "currency", sortable: true, align: "right" },
    { key: "expenditure_count", label: "Expenditures", type: "number", sortable: true, align: "right" },
  ],
  donors: [
    { key: "candidate_name", label: "Candidate", type: "string", sortable: true },
    { key: "source", label: "Source", type: "string", sortable: true },
    { key: "donor_name", label: "Donor", type: "string", sortable: true },
    { key: "amount", label: "Amount", type: "currency", sortable: true, align: "right" },
    { key: "employer", label: "Employer", type: "string" },
    { key: "occupation", label: "Occupation", type: "string" },
    { key: "city", label: "City", type: "string" },
    { key: "state", label: "State", type: "string" },
  ],
  geography: [
    { key: "name", label: "Candidate", type: "string", sortable: true },
    { key: "in_state_amount", label: "In-State", type: "currency", sortable: true, align: "right" },
    { key: "out_of_state_amount", label: "Out-of-State", type: "currency", sortable: true, align: "right" },
    { key: "in_state_pct", label: "In-State %", type: "number", sortable: true, align: "right" },
    { key: "diversity_score", label: "Diversity Score", type: "number", sortable: true, align: "right" },
  ],
  filings: [
    { key: "name", label: "Candidate", type: "string", sortable: true },
    { key: "filing_id", label: "Filing ID", type: "number", sortable: true },
    { key: "form_type", label: "Form", type: "string", sortable: true },
    { key: "rpt_date", label: "Report Date", type: "string", sortable: true },
    { key: "cash_on_hand", label: "Cash", type: "currency", sortable: true, align: "right" },
    { key: "receipts", label: "Receipts", type: "currency", sortable: true, align: "right" },
    { key: "expenditures", label: "Expenditures", type: "currency", sortable: true, align: "right" },
  ],
};

// SQL base queries for each dataset
const QUERIES: Record<string, string> = {
  summary: `SELECT co.*, c.name, c.party FROM candidate_overview co JOIN candidates c ON c.id = co.id WHERE c.is_primary = true`,
  contributions: `SELECT c.name, c.party, co.* FROM contributions co JOIN candidates c ON c.id = co.candidate_id`,
  spending: `SELECT c.name, c.party, s.* FROM spending s JOIN candidates c ON c.id = s.candidate_id`,
  donors: `SELECT c.name AS candidate_name, c.party, td.* FROM top_donors td JOIN candidates c ON c.id = td.candidate_id`,
  geography: `SELECT c.name, c.party, g.* FROM geography g JOIN candidates c ON c.id = g.candidate_id`,
  filings: `SELECT c.name, c.party, f.* FROM campaign_filings f JOIN candidates c ON c.id = f.candidate_id`,
};

const ALLOWED_SORT_KEYS = new Set([
  "name", "party", "cash_on_hand", "total_receipts", "total_expenditures", "burn_rate",
  "runway_months", "s497_total_raised", "unique_donors", "in_state_pct", "total_raised",
  "contribution_count", "avg_contribution", "repeat_donor_rate", "total_spending",
  "expenditure_count", "candidate_name", "source", "donor_name", "amount", "employer",
  "occupation", "city", "state", "in_state_amount", "out_of_state_amount", "diversity_score",
  "filing_id", "form_type", "rpt_date", "receipts", "expenditures",
]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const baseQuery = QUERIES[id];
  const columns = COLUMNS[id];

  if (!baseQuery || !columns) {
    return NextResponse.json({ error: "Unknown dataset" }, { status: 404 });
  }

  const sp = _req.nextUrl.searchParams;
  const search = sp.get("search");
  const sortKey = sp.get("sortKey");
  const sortDir = sp.get("sortDir") === "desc" ? "DESC" : "ASC";
  const limit = Math.min(Number(sp.get("limit")) || 100, 500);
  const offset = Number(sp.get("offset")) || 0;

  let sql = baseQuery;
  const qParams: unknown[] = [];
  let paramIdx = 1;

  if (search) {
    // Search across text columns
    const textCols = columns.filter(c => c.type === "string").map(c => c.key);
    if (textCols.length > 0) {
      const conditions = textCols.map(col => `CAST(${col} AS TEXT) ILIKE $${paramIdx}`);
      sql += ` AND (${conditions.join(" OR ")})`;
      qParams.push(`%${search}%`);
      paramIdx++;
    }
  }

  // Count total
  const countResult = await query(`SELECT count(*) FROM (${sql}) subq`, qParams);
  const total = Number(countResult.rows[0].count);

  // Sort
  if (sortKey && ALLOWED_SORT_KEYS.has(sortKey)) {
    sql += ` ORDER BY ${sortKey} ${sortDir} NULLS LAST`;
  }

  // Pagination
  sql += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  qParams.push(limit, offset);

  const result = await query(sql, qParams);

  return NextResponse.json({
    rows: result.rows,
    total,
    meta: {
      id,
      name: columns === COLUMNS.summary ? "Campaign Summary" : id.charAt(0).toUpperCase() + id.slice(1),
      columns,
      rowCount: total,
      lastUpdated: new Date().toISOString(),
    },
  });
}

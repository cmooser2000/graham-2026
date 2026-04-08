import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Returns candidate-level spending summary expected by SpendingTab comparison view:
// [{ candidate_id, name, party, total_spending, expenditure_count }]
function loadSpendingFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "campaign-spending.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    // Aggregate disbursements by candidate
    const byCandidate: Record<string, { total: number; count: number; party: string }> = {};
    for (const row of (data.spending || [])) {
      const name = row.candidate_name;
      if (!byCandidate[name]) byCandidate[name] = { total: 0, count: 0, party: row.party };
      byCandidate[name].total += row.amount;
      byCandidate[name].count += 1;
    }

    // Also pull totals from campaign-summary for completeness
    const summaryPath = join(process.cwd(), "data", "campaign-summary.json");
    const summaryRaw = readFileSync(summaryPath, "utf-8");
    const summary = JSON.parse(summaryRaw);

    return Object.entries(summary.candidates).map(([name, c]: [string, unknown], idx) => {
      const cand = c as Record<string, unknown>;
      const agg = byCandidate[name];
      return {
        candidate_id: idx + 1,
        name,
        party: cand.party ?? "",
        total_spending: cand.total_expenditures ?? agg?.total ?? 0,
        expenditure_count: agg?.count ?? null,
        fec_url: cand.fec_url ?? null,
      };
    }).sort((a, b) => (b.total_spending as number) - (a.total_spending as number));
  } catch (err) {
    return [];
  }
}

export async function GET() {
  return NextResponse.json(loadSpendingFromJson());
}

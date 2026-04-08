import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Load campaign summary from JSON (real FEC data, no DB required)
function loadSummaryFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "campaign-summary.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    // Transform to the FinanceSummary shape expected by the finance view
    return Object.entries(data.candidates).map(([name, c]: [string, unknown], idx) => {
      const cand = c as Record<string, unknown>;
      return {
        candidate_id: idx + 1,
        name,
        party: cand.party ?? null,
        cash_on_hand: cand.cash_on_hand != null ? String(cand.cash_on_hand) : null,
        total_receipts: cand.total_receipts != null ? String(cand.total_receipts) : null,
        total_expenditures: cand.total_expenditures != null ? String(cand.total_expenditures) : null,
        unique_donors: null,
        s497_total_raised: null,
        burn_rate: cand.burn_rate ?? null,
        fec_url: cand.fec_url ?? null,
        notes: cand.notes ?? null,
        outside_spending_committed: cand.outside_spending_committed ?? null,
        outside_spending_source: cand.outside_spending_source ?? null,
        outside_spending_url: cand.outside_spending_url ?? null,
        is_primary: name === "Graham Platner",
        has_form_460: false,
        data_source: "FEC.gov",
        reporting_period: (data as Record<string, unknown>).reporting_period ?? null,
      };
    }).sort((a, b) => {
      // Sort: Platner first, then by COH desc
      if (a.name === "Graham Platner") return -1;
      if (b.name === "Graham Platner") return 1;
      return parseFloat(b.cash_on_hand ?? "0") - parseFloat(a.cash_on_hand ?? "0");
    });
  } catch {
    return [];
  }
}

export async function GET() {
  const rows = loadSummaryFromJson();
  return NextResponse.json(rows);
}

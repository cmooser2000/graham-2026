import { NextResponse, NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Returns { by_category: [...], vendors: [...] } expected by SpendingTab drill-down
function loadBreakdownFromJson(candidateName?: string) {
  try {
    const filePath = join(process.cwd(), "data", "campaign-spending.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    const disbursements: {
      candidate_name: string; party: string; recipient_name: string;
      amount: number; description: string; category: string; date: string;
    }[] = data.spending || [];

    const filtered = candidateName
      ? disbursements.filter(r => r.candidate_name === candidateName)
      : disbursements;

    // Aggregate by category
    const catMap: Record<string, { category: string; amount: number; count: number; name?: string; party?: string }> = {};
    for (const row of filtered) {
      const cat = row.category || "Other";
      if (!catMap[cat]) catMap[cat] = { category: cat, amount: 0, count: 0, name: row.candidate_name, party: row.party };
      catMap[cat].amount += row.amount;
      catMap[cat].count += 1;
    }
    const by_category = Object.values(catMap).sort((a, b) => b.amount - a.amount);

    // Aggregate by vendor
    const vendorMap: Record<string, { vendor_name: string; amount: number; count: number; name?: string; party?: string }> = {};
    for (const row of filtered) {
      const v = row.recipient_name;
      if (!vendorMap[v]) vendorMap[v] = { vendor_name: v, amount: 0, count: 0, name: row.candidate_name, party: row.party };
      vendorMap[v].amount += row.amount;
      vendorMap[v].count += 1;
    }
    const vendors = Object.values(vendorMap).sort((a, b) => b.amount - a.amount).slice(0, 20);

    // Also pull from by_category block in JSON if present (more complete)
    const jsonCategories = data.by_category;
    if (jsonCategories && jsonCategories.length > 0 && !candidateName) {
      return { by_category: jsonCategories.map((c: { category: string; total: number; note?: string }) => ({
        category: c.category, amount: c.total, note: c.note
      })), vendors };
    }

    return { by_category, vendors };
  } catch {
    return { by_category: [], vendors: [] };
  }
}

export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidate_id");

  // Map candidate_id (integer) back to name via campaign-summary
  let candidateName: string | undefined;
  if (candidateId) {
    try {
      const summaryPath = join(process.cwd(), "data", "campaign-summary.json");
      const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));
      const names = Object.keys(summary.candidates);
      candidateName = names[parseInt(candidateId) - 1];
    } catch { /* ignore */ }
  }

  return NextResponse.json(loadBreakdownFromJson(candidateName));
}

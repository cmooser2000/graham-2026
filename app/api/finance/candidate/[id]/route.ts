import { NextResponse, NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadJson(filename: string) {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "data", filename), "utf-8"));
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const candidateIdx = parseInt(id) - 1; // IDs are 1-based

  const summary = loadJson("campaign-summary.json");
  if (!summary?.candidates) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const names = Object.keys(summary.candidates);
  const name = names[candidateIdx];
  if (!name) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const cand = summary.candidates[name];

  // Load supplementary data files
  const contributions = loadJson("campaign-contributions.json");
  const finance = loadJson("campaign-finance.json");
  const spending = loadJson("campaign-spending.json");
  const geography = loadJson("campaign-geography.json");
  const filings = loadJson("campaign-filings.json");
  const timeline = loadJson("campaign-timeline.json");
  const debts = loadJson("campaign-debts.json");
  const intel = loadJson("intel-analysis.json");

  const contribData = contributions?.candidates?.[name] ?? null;
  const financeData = finance?.candidates?.[name] ?? null;

  const spendingRows: unknown[] = (spending?.spending || []).filter(
    (r: Record<string, unknown>) => r.candidate_name === name
  );

  const geoRows: unknown[] = (geography?.geography || []).filter(
    (r: Record<string, unknown>) => r.candidate_name === name
  );

  const filingRows: unknown[] = (filings?.filings || []).filter(
    (r: Record<string, unknown>) => r.candidate_name === name
  );

  const timelineRows: unknown[] = (timeline?.timeline || []).filter(
    (r: Record<string, unknown>) => r.candidate_name === name
  );

  const debtRows = debts?.candidates?.[name] ?? null;

  // Build spending by category
  const catMap: Record<string, { category: string; amount: number; count: number }> = {};
  for (const row of spendingRows) {
    const r = row as Record<string, unknown>;
    const cat = String(r.category || "Other");
    if (!catMap[cat]) catMap[cat] = { category: cat, amount: 0, count: 0 };
    catMap[cat].amount += Number(r.amount) || 0;
    catMap[cat].count += 1;
  }
  const spendingByCategory = Object.values(catMap).sort((a, b) => b.amount - a.amount);

  // Build vendor rollup
  const vendorMap: Record<string, { vendor_name: string; amount: number; count: number }> = {};
  for (const row of spendingRows) {
    const r = row as Record<string, unknown>;
    const v = String(r.recipient_name || "Unknown");
    if (!vendorMap[v]) vendorMap[v] = { vendor_name: v, amount: 0, count: 0 };
    vendorMap[v].amount += Number(r.amount) || 0;
    vendorMap[v].count += 1;
  }
  const topVendors = Object.values(vendorMap).sort((a, b) => b.amount - a.amount).slice(0, 20);

  const financeObservations = (intel?.finance_summary?.[name]) ?? null;

  return NextResponse.json({
    candidate: {
      id: candidateIdx + 1,
      name,
      party: cand.party ?? "",
      fec_committee_id: cand.fec_committee_id ?? null,
      fec_url: cand.fec_url ?? null,
    },
    summary: {
      cash_on_hand: cand.cash_on_hand ?? null,
      total_receipts: cand.total_receipts ?? null,
      total_expenditures: cand.total_expenditures ?? null,
      burn_rate: cand.burn_rate ?? null,
      runway_months: cand.runway_months ?? null,
    },
    contributions: contribData ? {
      total_raised: contribData.total_raised,
      contribution_count: contribData.contribution_count,
      unique_donors: contribData.unique_donors,
      avg_contribution: contribData.avg_contribution,
    } : null,
    contributions_by_size: contribData
      ? Object.entries(contribData.by_size || {}).map(([bucket, amount]) => ({
          size_bucket: bucket, amount, count: (contribData.by_size_count || {})[bucket] ?? 0,
        }))
      : [],
    contributions_by_type: contribData
      ? Object.entries(contribData.by_type || {}).map(([type, amount]) => ({
          contributor_type: type, amount, count: (contribData.by_type_count || {})[type] ?? 0,
        }))
      : [],
    spending: spending ? {
      total_spending: cand.total_expenditures ?? 0,
      expenditure_count: spendingRows.length || null,
    } : null,
    spending_by_category: spendingByCategory,
    top_vendors: topVendors,
    debts: debtRows,
    top_creditors: debtRows?.creditors ?? [],
    top_lenders: debtRows?.lenders ?? [],
    geography: geoRows.length > 0 ? { total_itemized: contribData?.itemized_raised ?? 0 } : null,
    geography_regions: [],
    geography_cities: [],
    geography_states: geoRows,
    top_donors: contribData?.top_donors ?? [],
    late_contributions: financeData ? {
      total_raised: financeData.total_raised,
      donor_count: financeData.donor_count,
      avg_donation: financeData.avg_donation,
    } : null,
    late_by_state: financeData
      ? Object.entries(financeData.by_state || {}).map(([state, amount]) => ({
          candidate_name: name, state, amount,
        })).sort((a, b) => b.amount - a.amount)
      : [],
    late_by_occupation: [],
    filings: filingRows,
    timeline: timelineRows,
    intel: financeObservations,
  });
}

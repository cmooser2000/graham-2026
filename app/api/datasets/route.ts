import { query } from "@/lib/db";
import { NextResponse } from "next/server";

const DATASET_DEFS = [
  {
    id: "summary",
    name: "Campaign Summary",
    description: "Cash on hand, receipts, expenditures, burn rate per candidate",
    table: "candidate_overview",
  },
  {
    id: "contributions",
    name: "Contributions",
    description: "Donor counts, averages, repeat rates per candidate",
    table: "contributions",
  },
  {
    id: "spending",
    name: "Spending",
    description: "Expenditure totals and category breakdowns",
    table: "spending",
  },
  {
    id: "donors",
    name: "Top Donors",
    description: "Searchable donor records across all candidates",
    table: "top_donors",
  },
  {
    id: "geography",
    name: "Geography",
    description: "In-state vs out-of-state contributions",
    table: "geography",
  },
  {
    id: "filings",
    name: "Filings",
    description: "Campaign filing records from FEC",
    table: "campaign_filings",
  },
];

export async function GET() {
  const datasets = [];
  for (const def of DATASET_DEFS) {
    const count = await query(`SELECT count(*) FROM ${def.table}`);
    datasets.push({
      ...def,
      rowCount: Number(count.rows[0].count),
      lastUpdated: new Date().toISOString(),
    });
  }
  return NextResponse.json(datasets);
}

export { DATASET_DEFS };

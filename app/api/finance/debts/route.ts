import { NextResponse, NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

/* eslint-disable @typescript-eslint/no-explicit-any */

function loadDebtsFromJson(candidateName?: string) {
  try {
    const filePath = join(process.cwd(), "data", "campaign-debts.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    const candidates = data.candidates as Record<string, any>;

    // Build summary rows
    const summary = Object.entries(candidates)
      .filter(([name]) => !candidateName || name === candidateName)
      .map(([name, c]: [string, any], idx) => ({
        candidate_id: idx + 1,
        name,
        party: c.party ?? (name === "Susan Collins" ? "R" : "D"),
        total_debt: String(c.total_debt ?? 0),
        total_loans: String(c.total_loans ?? 0),
        self_loans: String(c.self_loans ?? 0),
        cash_on_hand: null,
      }));

    // If drilling into a specific candidate, get creditors/lenders
    const targetName = candidateName || (summary.length === 1 ? summary[0].name : null);
    const target = targetName ? candidates[targetName] : null;

    const creditors = (target?.top_creditors ?? []).map((c: any) => ({
      name: c.creditor ?? c.name,
      amount: c.amount,
    }));

    const lenders = (target?.top_lenders ?? []).map((l: any) => ({
      name: l.lender ?? l.name,
      amount: l.amount,
    }));

    return { summary, creditors, lenders };
  } catch {
    return { summary: [], creditors: [], lenders: [] };
  }
}

export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidate_id");

  let candidateName: string | undefined;
  if (candidateId) {
    try {
      const summaryPath = join(process.cwd(), "data", "campaign-debts.json");
      const data = JSON.parse(readFileSync(summaryPath, "utf-8"));
      const names = Object.keys(data.candidates);
      candidateName = names[parseInt(candidateId) - 1];
    } catch { /* ignore */ }
  }

  return NextResponse.json(loadDebtsFromJson(candidateName));
}

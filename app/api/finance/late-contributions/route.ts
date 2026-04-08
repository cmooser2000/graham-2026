import { NextResponse, NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadLateContributionsFromJson(candidateId?: string | null) {
  try {
    const filePath = join(process.cwd(), "data", "campaign-finance.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    let candidates = Object.entries(data.candidates || {});
    if (candidateId) {
      // Filter to requested candidate by index (1-based)
      const idx = parseInt(candidateId) - 1;
      candidates = candidates.slice(idx, idx + 1);
    }

    const summary = candidates.map(([name, c]: [string, unknown], idx) => {
      const cand = c as Record<string, unknown>;
      return {
        candidate_id: parseInt(candidateId || "") || idx + 1,
        name,
        party: cand.party ?? "",
        total_raised: cand.total_raised ?? 0,
        donor_count: cand.donor_count ?? null,
        avg_donation: cand.avg_donation ?? null,
      };
    });

    const byState = candidates.flatMap(([name, c]: [string, unknown]) => {
      const cand = c as Record<string, unknown>;
      const stateMap = (cand.by_state ?? {}) as Record<string, number>;
      return Object.entries(stateMap).map(([state, amount]) => ({
        candidate_name: name,
        party: cand.party ?? "",
        state,
        amount,
      }));
    }).sort((a, b) => b.amount - a.amount);

    return { summary, by_state: byState, by_occupation: [] };
  } catch {
    return { summary: [], by_state: [], by_occupation: [] };
  }
}

export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidate_id");
  return NextResponse.json(loadLateContributionsFromJson(candidateId));
}

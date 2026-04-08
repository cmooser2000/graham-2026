import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadContributionsFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "campaign-contributions.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    // Flatten candidate map into array format expected by the component
    return Object.entries(data.candidates || {}).map(([name, c]: [string, unknown], idx) => {
      const cand = c as Record<string, unknown>;
      return {
        candidate_id: idx + 1,
        name,
        party: cand.party ?? "",
        total_raised: cand.total_raised ?? 0,
        contribution_count: cand.contribution_count ?? null,
        unique_donors: cand.unique_donors ?? null,
        avg_contribution: cand.avg_contribution ?? null,
        by_size: cand.by_size ?? {},
        by_size_count: cand.by_size_count ?? {},
        by_type: cand.by_type ?? {},
        by_type_count: cand.by_type_count ?? {},
        top_donors: cand.top_donors ?? [],
      };
    });
  } catch {
    return [];
  }
}

export async function GET() {
  return NextResponse.json(loadContributionsFromJson());
}

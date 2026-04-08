import { NextResponse, NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadGeoDetailFromJson(candidateName?: string) {
  try {
    const filePath = join(process.cwd(), "data", "campaign-geography.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    let states: unknown[] = data.geography || [];
    if (candidateName) {
      states = states.filter((r: unknown) => (r as Record<string, unknown>).candidate_name === candidateName);
    }

    // Sort by amount desc
    states = [...states].sort((a, b) =>
      ((b as Record<string, unknown>).total as number) - ((a as Record<string, unknown>).total as number)
    );

    return { regions: [], cities: [], states };
  } catch {
    return { regions: [], cities: [], states: [] };
  }
}

export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidate_id");

  let candidateName: string | undefined;
  if (candidateId) {
    try {
      const summaryPath = join(process.cwd(), "data", "campaign-summary.json");
      const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));
      const names = Object.keys(summary.candidates);
      candidateName = names[parseInt(candidateId) - 1];
    } catch { /* ignore */ }
  }

  return NextResponse.json(loadGeoDetailFromJson(candidateName));
}

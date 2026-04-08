import { NextResponse, NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadBreakdownFromJson(candidateName?: string) {
  try {
    const filePath = join(process.cwd(), "data", "campaign-contributions.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    const candidates = candidateName
      ? Object.entries(data.candidates || {}).filter(([n]) => n === candidateName)
      : Object.entries(data.candidates || {});

    const bySize: unknown[] = [];
    const byType: unknown[] = [];

    for (const [name, c] of candidates) {
      const cand = c as Record<string, unknown>;
      const sizeMap = (cand.by_size ?? {}) as Record<string, number>;
      const sizeCountMap = (cand.by_size_count ?? {}) as Record<string, number>;
      const typeMap = (cand.by_type ?? {}) as Record<string, number>;
      const typeCountMap = (cand.by_type_count ?? {}) as Record<string, number>;

      for (const [bucket, amount] of Object.entries(sizeMap)) {
        bySize.push({ name, party: cand.party, size_bucket: bucket, amount, count: sizeCountMap[bucket] ?? 0 });
      }
      for (const [type, amount] of Object.entries(typeMap)) {
        byType.push({ name, party: cand.party, contributor_type: type, amount, count: typeCountMap[type] ?? 0 });
      }
    }

    return { by_size: bySize, by_type: byType };
  } catch {
    return { by_size: [], by_type: [] };
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

  return NextResponse.json(loadBreakdownFromJson(candidateName));
}

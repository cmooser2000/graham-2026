import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadFollowersFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "social-stats.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    const candidates = Object.entries(data.candidates as Record<string, {
      party: string;
      accounts: Record<string, { handle?: string; followers?: number; url?: string; followers_note?: string }>;
    }>).map(([name, cand]) => {
      const yt = cand.accounts?.youtube;
      return {
        name,
        party: cand.party,
        handle: yt?.handle || null,
        subscribers: yt?.followers || 0,
        instagram: cand.accounts?.instagram?.followers || null,
        instagram_note: cand.accounts?.instagram?.followers_note || null,
        x: cand.accounts?.x?.followers || null,
        x_note: cand.accounts?.x?.followers_note || null,
        facebook: cand.accounts?.facebook?.followers || null,
      };
    });

    return NextResponse.json({
      candidates,
      latestDate: data.generated_at?.split("T")[0] || null,
      note: data.note || null,
      source: data.data_source || "data/social-stats.json",
    });
  } catch {
    return NextResponse.json({ candidates: [], latestDate: null, note: "Social data not available" });
  }
}

export async function GET() {
  return loadFollowersFromJson();
}

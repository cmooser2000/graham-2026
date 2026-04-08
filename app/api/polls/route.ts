import { NextResponse, NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Load real poll data from JSON (no DB required)
function loadPollsFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "polls.json");
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { poll_count: 0, polls: [] };
  }
}

export async function GET(req: NextRequest) {
  const data = loadPollsFromJson();
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "30", 10);

  const polls = (data.polls || []).slice(0, limit);

  return NextResponse.json({
    poll_count: polls.length,
    polls,
    source: data.data_source || "data/polls.json",
    note: data.note || null,
  });
}

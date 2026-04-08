import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadTimelineFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "campaign-timeline.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data.timeline || data);
  } catch {
    return NextResponse.json([]);
  }
}

export async function GET() {
  return loadTimelineFromJson();
}

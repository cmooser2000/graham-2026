import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadYoutubeFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "youtube-content.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json({
      channels: data.channels || [],
      videos: data.videos || [],
      source: data.data_source || "data/youtube-content.json",
      note: data.note || null,
    });
  } catch {
    return NextResponse.json({ channels: [], videos: [], note: "YouTube data not yet collected for Maine 2026 Senate race" });
  }
}

export async function GET() {
  return loadYoutubeFromJson();
}

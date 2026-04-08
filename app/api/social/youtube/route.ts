import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function loadYoutubeFromJson() {
  try {
    const filePath = join(process.cwd(), "data", "youtube-content.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    // Transform channels from JSON shape to component-expected shape
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channels = (data.channels || []).map((c: any) => ({
      candidate_name: c.candidate || c.candidate_name || "",
      party: c.party || "",
      handle: c.channelInfo?.handle || c.handle || "",
      url: c.channelInfo?.url || c.url || "",
      subscribers: c.channelStats?.subscribers ?? null,
      total_videos: c.channelStats?.totalVideos ?? null,
      note: c.channelStats?.note || null,
    }));

    return NextResponse.json({
      channels,
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

import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const RSS_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id=";

interface RssVideo {
  id: string;
  url: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  channelId: string;
  candidate_name: string;
  party: string;
}

async function fetchChannelRss(
  channelId: string,
  candidateName: string,
  party: string
): Promise<RssVideo[]> {
  try {
    const res = await fetch(`${RSS_BASE}${channelId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 }, // cache for 1 hour
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Parse entries from Atom XML
    const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
    return entries.map((entry) => {
      const videoId = (entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1] || "";
      const title = (entry.match(/<title>(.*?)<\/title>/) || [])[1] || "";
      const published = (entry.match(/<published>(.*?)<\/published>/) || [])[1] || "";
      return {
        id: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'),
        publishedAt: published,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        channelId,
        candidate_name: candidateName,
        party,
      };
    });
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    // Load channel list from JSON
    const raw = readFileSync(join(process.cwd(), "data", "youtube-content.json"), "utf-8");
    const data = JSON.parse(raw);

    // Fetch RSS for all channels in parallel
    const videoArrays = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data.channels || []).map((c: any) => {
        const channelId = c.channelInfo?.channelId;
        if (!channelId) return Promise.resolve([]);
        return fetchChannelRss(channelId, c.candidate || "", c.party || "");
      })
    );

    const videos: RssVideo[] = videoArrays.flat().sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Build channel summary rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channels = (data.channels || []).map((c: any) => ({
      candidate_name: c.candidate || "",
      party: c.party || "",
      handle: c.channelInfo?.handle || "",
      url: c.channelInfo?.url || "",
      subscribers: null, // RSS doesn't expose subscriber count
      total_videos: videoArrays[data.channels.indexOf(c)]?.length ?? null,
    }));

    return NextResponse.json({
      channels,
      videos,
      source: "YouTube RSS feeds (free, no API key)",
    });
  } catch {
    return NextResponse.json({ channels: [], videos: [], note: "Failed to load YouTube data" });
  }
}

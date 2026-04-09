import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const RSS_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id=";
const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

interface RssVideo {
  video_id: string;
  url: string;
  title: string;
  published_at: string;
  thumbnail: string;
  channelId: string;
  candidate_name: string;
  party: string;
  views: number;
  likes: number;
  comments: number;
}

async function fetchChannelRss(
  channelId: string,
  candidateName: string,
  party: string
): Promise<RssVideo[]> {
  try {
    const res = await fetch(`${RSS_BASE}${channelId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
    return entries.map((entry) => {
      const videoId = (entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1] || "";
      const title = (entry.match(/<title>(.*?)<\/title>/) || [])[1] || "";
      const published = (entry.match(/<published>(.*?)<\/published>/) || [])[1] || "";
      return {
        video_id: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'),
        published_at: published,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        channelId,
        candidate_name: candidateName,
        party,
        views: 0,
        likes: 0,
        comments: 0,
      };
    });
  } catch {
    return [];
  }
}

async function fetchChannelStats(channelIds: string[], apiKey: string): Promise<Record<string, { subscribers: number; totalVideos: number }>> {
  try {
    const url = `${YT_API_BASE}/channels?part=statistics&id=${channelIds.join(",")}&key=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const data = await res.json();
    const result: Record<string, { subscribers: number; totalVideos: number }> = {};
    for (const item of (data.items || [])) {
      result[item.id] = {
        subscribers: parseInt(item.statistics?.subscriberCount || "0"),
        totalVideos: parseInt(item.statistics?.videoCount || "0"),
      };
    }
    return result;
  } catch {
    return {};
  }
}

async function fetchVideoStats(videoIds: string[], apiKey: string): Promise<Record<string, { views: number; likes: number; comments: number }>> {
  try {
    // YouTube API allows up to 50 IDs per request
    const chunks: string[][] = [];
    for (let i = 0; i < videoIds.length; i += 50) chunks.push(videoIds.slice(i, i + 50));
    const result: Record<string, { views: number; likes: number; comments: number }> = {};
    for (const chunk of chunks) {
      const url = `${YT_API_BASE}/videos?part=statistics&id=${chunk.join(",")}&key=${apiKey}`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of (data.items || [])) {
        result[item.id] = {
          views: parseInt(item.statistics?.viewCount || "0"),
          likes: parseInt(item.statistics?.likeCount || "0"),
          comments: parseInt(item.statistics?.commentCount || "0"),
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const raw = readFileSync(join(process.cwd(), "data", "youtube-content.json"), "utf-8");
    const data = JSON.parse(raw);
    const apiKey = process.env.YOUTUBE_API_KEY;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channelList: { channelId: string; candidate: string; party: string }[] = (data.channels || []).map((c: any) => ({
      channelId: c.channelInfo?.channelId || "",
      candidate: c.candidate || "",
      party: c.party || "",
    })).filter((c: { channelId: string }) => c.channelId);

    // Fetch RSS videos for all channels in parallel
    const videoArrays = await Promise.all(
      channelList.map(c => fetchChannelRss(c.channelId, c.candidate, c.party))
    );

    let videos: RssVideo[] = videoArrays.flat().sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );

    // Fetch real stats from YouTube Data API if key is available
    let channelStatsMap: Record<string, { subscribers: number; totalVideos: number }> = {};
    if (apiKey) {
      const allChannelIds = channelList.map(c => c.channelId);
      const allVideoIds = videos.map(v => v.video_id).filter(Boolean);
      const [chStats, vidStats] = await Promise.all([
        fetchChannelStats(allChannelIds, apiKey),
        fetchVideoStats(allVideoIds, apiKey),
      ]);
      channelStatsMap = chStats;
      // Merge view/like/comment counts into videos
      videos = videos.map(v => ({
        ...v,
        ...(vidStats[v.video_id] || {}),
      }));
    }

    // Build channel summary
    const channels = channelList.map((c, i) => {
      const stats = channelStatsMap[c.channelId];
      return {
        candidate_name: c.candidate,
        party: c.party,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handle: (data.channels[i] as any)?.channelInfo?.handle || "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        url: (data.channels[i] as any)?.channelInfo?.url || "",
        subscribers: stats?.subscribers ?? null,
        total_videos: stats?.totalVideos ?? videoArrays[i]?.length ?? null,
      };
    });

    return NextResponse.json({
      channels,
      videos,
      source: apiKey ? "YouTube Data API v3 + RSS" : "YouTube RSS feeds (no API key — subscriber/view counts unavailable)",
    });
  } catch {
    return NextResponse.json({ channels: [], videos: [], note: "Failed to load YouTube data" });
  }
}

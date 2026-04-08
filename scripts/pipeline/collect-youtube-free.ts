#!/usr/bin/env npx ts-node
/**
 * YouTube content collector using free YouTube Data API v3
 * Run with: npx ts-node scripts/collect-youtube-free.ts
 *
 * Uses:
 * - YouTube RSS feeds (free, no auth) for video list discovery
 * - YouTube Data API v3 (free, 10k units/day) for channel & video stats
 *
 * Quota usage: ~14 units per run (7 channel calls + 7 video batch calls)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

if (!YOUTUBE_API_KEY) {
  console.error("Error: YOUTUBE_API_KEY environment variable is required");
  console.error("Get a free API key at https://console.cloud.google.com/apis/credentials");
  console.error("Enable 'YouTube Data API v3' in your Google Cloud project");
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, "..", "..", "data");

// YouTube channel IDs for candidates
// Candidates may have multiple channels (e.g. congressional + campaign).
// Stats are aggregated across all channels per candidate.
const CANDIDATE_YOUTUBE_CHANNELS: Record<
  string,
  { channelId: string; handle: string; url: string }[]
> = {
  "Eric Swalwell": [
    { channelId: "UCKvwsFNGD4sDkE_9g-2ft0w", handle: "@RepSwalwell", url: "https://youtube.com/@RepSwalwell" },
    { channelId: "UCQchDpbi_FXAswnCiIXKIcA", handle: "@Eric_Swalwell", url: "https://youtube.com/@Eric_Swalwell" },
  ],
  "Katie Porter": [
    { channelId: "UCRdB2ce4DloCSyuPbWfOZyw", handle: "@KatiePorterCA", url: "https://youtube.com/@KatiePorterCA" },
  ],
  "Tom Steyer": [
    { channelId: "UCpYi4-Hlcxaxink1nx5UgQA", handle: "@TomSteyer", url: "https://youtube.com/@TomSteyer" },
  ],
  "Chad Bianco": [
    { channelId: "UCwIQEBl9JAoRZD4ghSJmu8g", handle: "@ChadBianco", url: "https://youtube.com/@ChadBianco" },
  ],
  "Steve Hilton": [
    { channelId: "UCRLW7UzXhlckSTyb8dw5YAw", handle: "@SteveHiltonx", url: "https://youtube.com/@SteveHiltonx" },
  ],
  "Matt Mahan": [
    { channelId: "UCePbQz1iC9qgNcxtAwv3_zQ", handle: "@mayormatt", url: "https://youtube.com/@mayormatt" },
  ],
};

const PARTY_MAP: Record<string, "D" | "R" | "I"> = {
  "Eric Swalwell": "D",
  "Katie Porter": "D",
  "Tom Steyer": "D",
  "Chad Bianco": "R",
  "Steve Hilton": "R",
  "Matt Mahan": "D",
};

interface YouTubeVideo {
  id: string;
  url: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  views: number;
  likes: number;
  comments: number;
  engagement: number;
  engagementRate: number;
}

interface YouTubeChannelStats {
  url: string;
  username: string;
  nickname: string;
  bio: string;
  verified: boolean;
  avatar: string;
  subscribers: number;
  totalVideos: number;
  banner: string;
}

interface CandidateYouTubeContent {
  candidate: string;
  party: "D" | "R" | "I";
  /** Primary channel info (first channel in list) */
  channelInfo: { channelId: string; handle: string; url: string } | null;
  /** Aggregated stats across all channels */
  channelStats: YouTubeChannelStats | null;
  /** All channel handles for display */
  handles: string[];
  recentVideos: YouTubeVideo[];
  totalViews: number;
  totalEngagement: number;
  avgEngagementRate: number;
}

let quotaUsed = 0;

async function fetchWithTimeout(url: string, timeout = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

function decodeXMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Fetch recent videos from YouTube RSS feed (free, no auth, no quota)
 */
async function fetchYouTubeRSS(
  channelId: string,
  maxVideos = 5
): Promise<Array<{
  id: string;
  url: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
}>> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const response = await fetchWithTimeout(rssUrl);

    if (!response.ok) {
      console.error(`YouTube RSS error: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const videos: Array<{
      id: string;
      url: string;
      title: string;
      description: string;
      thumbnail: string;
      publishedAt: string;
      channelId: string;
      channelTitle: string;
    }> = [];

    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    const entries = xml.match(entryRegex) || [];

    for (const entry of entries.slice(0, maxVideos)) {
      const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const videoId = videoIdMatch?.[1] || "";

      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch?.[1] || "";

      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
      const publishedAt = publishedMatch?.[1] || "";

      const channelNameMatch = entry.match(/<name>([^<]+)<\/name>/);
      const channelTitle = channelNameMatch?.[1] || "";

      const descMatch = entry.match(/<media:description>([^<]*)<\/media:description>/);
      const description = descMatch?.[1] || "";

      const thumbMatch = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/);
      const thumbnail = thumbMatch?.[1] || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      if (videoId) {
        videos.push({
          id: videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: decodeXMLEntities(title),
          description: decodeXMLEntities(description),
          thumbnail,
          publishedAt,
          channelId,
          channelTitle: decodeXMLEntities(channelTitle),
        });
      }
    }

    return videos;
  } catch (error) {
    console.error(`Failed to fetch YouTube RSS for ${channelId}:`, error);
    return [];
  }
}

/**
 * Fetch channel statistics via YouTube Data API v3
 * Cost: 1 quota unit per call
 */
async function getChannelStats(
  channelId: string,
  handle: string,
  channelUrl: string
): Promise<YouTubeChannelStats | null> {
  try {
    const url = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${YOUTUBE_API_KEY}`;
    const response = await fetchWithTimeout(url);
    quotaUsed += 1;

    if (!response.ok) {
      const text = await response.text();
      console.error(`YouTube API channel stats error: ${response.status} - ${text}`);
      return null;
    }

    const data = await response.json();
    const channel = data.items?.[0];
    if (!channel) {
      console.error(`No channel found for ID: ${channelId}`);
      return null;
    }

    const snippet = channel.snippet;
    const stats = channel.statistics;
    const branding = channel.brandingSettings;

    return {
      url: channelUrl,
      username: handle,
      nickname: snippet.title || "",
      bio: snippet.description || "",
      verified: false, // YouTube Data API doesn't expose verification status
      avatar: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || "",
      subscribers: parseInt(stats.subscriberCount || "0", 10),
      totalVideos: parseInt(stats.videoCount || "0", 10),
      banner: branding?.image?.bannerExternalUrl || "",
    };
  } catch (error) {
    console.error(`Failed to fetch channel stats for ${channelId}:`, error);
    return null;
  }
}

/**
 * Fetch video statistics in batch via YouTube Data API v3
 * Cost: 1 quota unit per call, supports up to 50 video IDs
 */
async function getVideoStatsBatch(
  videoIds: string[]
): Promise<Map<string, { views: number; likes: number; comments: number }>> {
  const statsMap = new Map<string, { views: number; likes: number; comments: number }>();

  if (videoIds.length === 0) return statsMap;

  try {
    const ids = videoIds.join(",");
    const url = `${YOUTUBE_API_BASE}/videos?part=statistics&id=${ids}&key=${YOUTUBE_API_KEY}`;
    const response = await fetchWithTimeout(url);
    quotaUsed += 1;

    if (!response.ok) {
      const text = await response.text();
      console.error(`YouTube API video stats error: ${response.status} - ${text}`);
      return statsMap;
    }

    const data = await response.json();
    for (const item of data.items || []) {
      const stats = item.statistics;
      statsMap.set(item.id, {
        views: parseInt(stats.viewCount || "0", 10),
        likes: parseInt(stats.likeCount || "0", 10),
        comments: parseInt(stats.commentCount || "0", 10),
      });
    }
  } catch (error) {
    console.error(`Failed to fetch video stats batch:`, error);
  }

  return statsMap;
}

function calculateEngagement(views: number, likes: number, comments: number): number {
  return views + likes * 3 + comments * 5;
}

function calculateEngagementRate(views: number, likes: number, comments: number): number {
  if (views === 0) return 0;
  return ((likes + comments) / views) * 100;
}

async function collectYouTubeData(): Promise<{
  collected_at: string;
  candidates: CandidateYouTubeContent[];
}> {
  console.log("Collecting YouTube content data (YouTube Data API v3)...\n");

  const results: CandidateYouTubeContent[] = [];

  for (const [name, channels] of Object.entries(CANDIDATE_YOUTUBE_CHANNELS)) {
    if (!channels || channels.length === 0) continue;

    console.log(`\n${name} (${channels.length} channel${channels.length > 1 ? "s" : ""}):`);

    const result: CandidateYouTubeContent = {
      candidate: name,
      party: PARTY_MAP[name] || "D",
      channelInfo: channels[0], // primary channel
      channelStats: null,
      handles: channels.map((c) => c.handle),
      recentVideos: [],
      totalViews: 0,
      totalEngagement: 0,
      avgEngagementRate: 0,
    };

    // Aggregate stats across all channels
    let totalSubscribers = 0;
    let totalVideosCount = 0;
    let primaryStats: YouTubeChannelStats | null = null;
    const allRssVideos: Array<{
      id: string; url: string; title: string; description: string;
      thumbnail: string; publishedAt: string; channelId: string; channelTitle: string;
    }> = [];

    for (const ch of channels) {
      console.log(`  [${ch.handle}] Fetching channel stats...`);
      const stats = await getChannelStats(ch.channelId, ch.handle, ch.url);
      if (stats) {
        console.log(`    Subscribers: ${stats.subscribers.toLocaleString()}`);
        console.log(`    Total videos: ${stats.totalVideos.toLocaleString()}`);
        totalSubscribers += stats.subscribers;
        totalVideosCount += stats.totalVideos;
        if (!primaryStats) primaryStats = stats;
      }

      console.log(`  [${ch.handle}] Fetching RSS feed...`);
      const rssVideos = await fetchYouTubeRSS(ch.channelId, 5);
      console.log(`    Found ${rssVideos.length} videos`);
      allRssVideos.push(...rssVideos);
    }

    // Build aggregated channel stats
    if (primaryStats) {
      result.channelStats = {
        ...primaryStats,
        username: result.handles.join(" + "),
        subscribers: totalSubscribers,
        totalVideos: totalVideosCount,
      };
    }

    // Sort all videos by date (newest first), take top 5
    allRssVideos.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    const topVideos = allRssVideos.slice(0, 5);

    // Batch fetch video stats
    if (topVideos.length > 0) {
      console.log(`  Fetching video stats (batch)...`);
      const videoIds = topVideos.map((v) => v.id);
      const statsMap = await getVideoStatsBatch(videoIds);

      const videosWithStats: YouTubeVideo[] = [];
      for (const video of topVideos) {
        const stats = statsMap.get(video.id);
        const views = stats?.views || 0;
        const likes = stats?.likes || 0;
        const comments = stats?.comments || 0;

        videosWithStats.push({
          ...video,
          views,
          likes,
          comments,
          engagement: calculateEngagement(views, likes, comments),
          engagementRate: calculateEngagementRate(views, likes, comments),
        });

        console.log(`    ${video.title.substring(0, 50)}... → ${views.toLocaleString()} views`);
      }

      result.recentVideos = videosWithStats;

      result.totalViews = videosWithStats.reduce((sum, v) => sum + v.views, 0);
      result.totalEngagement = videosWithStats.reduce((sum, v) => sum + v.engagement, 0);
      result.avgEngagementRate =
        videosWithStats.reduce((sum, v) => sum + v.engagementRate, 0) / videosWithStats.length;
    }

    console.log(`  Combined: ${totalSubscribers.toLocaleString()} subs, ${totalVideosCount} videos, ${result.totalViews.toLocaleString()} recent views`);
    results.push(result);
  }

  // Sort by total views
  results.sort((a, b) => b.totalViews - a.totalViews);

  return {
    collected_at: new Date().toISOString(),
    candidates: results,
  };
}

async function main() {
  console.log("Starting YouTube content collection (free API)...\n");

  try {
    const youtubeData = await collectYouTubeData();

    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const youtubePath = path.join(DATA_DIR, "youtube-content.json");
    fs.writeFileSync(youtubePath, JSON.stringify(youtubeData, null, 2));
    console.log(`\n✓ YouTube data saved to ${youtubePath}`);
    console.log(`  Total candidates with YouTube: ${youtubeData.candidates.length}`);
    console.log(`  API quota units used: ${quotaUsed} / 10,000`);

    console.log("\n✅ YouTube collection complete!");
  } catch (error) {
    console.error("\n❌ Collection failed:", error);
    process.exit(1);
  }
}

main();

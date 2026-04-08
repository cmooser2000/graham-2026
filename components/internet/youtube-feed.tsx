"use client";

import { useState, useEffect, useMemo } from "react";
import { ExternalLink, Eye, ThumbsUp, MessageCircle } from "lucide-react";

interface YTChannel {
  candidate_name: string;
  party: string;
  subscribers: number;
  total_videos: number;
  handle: string;
}

interface YTVideo {
  candidate_name: string;
  video_id: string;
  url: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  published_at: string;
}

interface YoutubeResponse {
  channels: YTChannel[];
  videos: YTVideo[];
  error?: string;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(d: string): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function timeAgo(d: string): string {
  if (!d) return "";
  const now = Date.now();
  const then = new Date(d).getTime();
  const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function YoutubeFeed() {
  const [data, setData] = useState<YoutubeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"recent" | "all">("recent");

  useEffect(() => {
    fetch("/api/social/youtube")
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
      })
      .catch(() => setError("Failed to load YouTube data"))
      .finally(() => setLoading(false));
  }, []);

  const filteredVideos = useMemo(() => {
    if (!data?.videos) return [];
    if (filter === "all") return data.videos;
    // Recent = last 90 days
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return data.videos.filter(v => v.published_at && new Date(v.published_at).getTime() > cutoff);
  }, [data, filter]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><span className="text-terminal-yellow glow-yellow animate-pulse">Loading...</span></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center py-12"><span className="text-terminal-red">ERR: {error}</span></div>;
  }

  if (!data) {
    return <div className="flex items-center justify-center py-12"><span className="text-terminal-dim">No YouTube data available</span></div>;
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Channels */}
      <div>
        <h3 className="text-terminal-xs text-terminal-blue font-medium tracking-widest uppercase mb-2">Channels</h3>
        {data.channels.length === 0 ? (
          <div className="text-terminal-dim text-terminal-xs py-4 text-center">No channel data</div>
        ) : (
          <div className="flex flex-col gap-1">
            {data.channels.map(ch => (
              <div key={ch.candidate_name} className="flex items-center gap-3 bg-terminal-panel border border-border rounded px-3 py-2">
                <span className="text-terminal-sm font-medium w-[120px] truncate">{ch.candidate_name}</span>
                <span className="text-terminal-xs text-terminal-dim">{ch.handle}</span>
                <span className="text-terminal-sm text-terminal-yellow tabular-nums ml-auto">{ch.subscribers != null ? `${formatCount(ch.subscribers)} subs` : "subs N/A"}</span>
                <span className="text-terminal-xs text-terminal-dim">{ch.total_videos != null ? `${ch.total_videos} videos` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Videos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-terminal-xs text-terminal-blue font-medium tracking-widest uppercase">Videos</h3>
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilter("recent")}
              className={`px-2 py-0.5 rounded text-terminal-xs ${filter === "recent" ? "bg-terminal-raised text-terminal-yellow border border-terminal-yellow/30" : "text-terminal-dim border border-border"}`}
            >
              Recent
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`px-2 py-0.5 rounded text-terminal-xs ${filter === "all" ? "bg-terminal-raised text-terminal-yellow border border-terminal-yellow/30" : "text-terminal-dim border border-border"}`}
            >
              All Time
            </button>
          </div>
        </div>
        {filteredVideos.length === 0 ? (
          <div className="text-terminal-dim text-terminal-xs py-4 text-center">
            {filter === "recent" ? "No videos in the last 90 days" : "No video data"}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredVideos.slice(0, 20).map(v => {
              const hasEngagement = (v.likes + v.comments) > 0;
              return (
                <div key={v.video_id} className="bg-terminal-panel border border-border rounded px-3 py-2">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-terminal-xs text-terminal-cyan">{v.candidate_name}</span>
                      {v.published_at && (
                        <span className="text-terminal-xs text-terminal-dim shrink-0">{timeAgo(v.published_at)}</span>
                      )}
                    </div>
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-terminal-dim hover:text-terminal-yellow shrink-0">
                      <ExternalLink size={10} />
                    </a>
                  </div>
                  <p className="text-terminal-sm line-clamp-1 mb-1">{v.title}</p>
                  <div className="flex items-center gap-3 text-terminal-xs">
                    <span className="flex items-center gap-1 text-terminal-yellow"><Eye size={10} /> {formatCount(v.views)}</span>
                    {hasEngagement && (
                      <>
                        <span className="flex items-center gap-1 text-terminal-red"><ThumbsUp size={10} /> {formatCount(v.likes)}</span>
                        <span className="flex items-center gap-1 text-terminal-green"><MessageCircle size={10} /> {formatCount(v.comments)}</span>
                      </>
                    )}
                    {v.published_at && (
                      <span className="text-terminal-dim ml-auto">{formatDate(v.published_at)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

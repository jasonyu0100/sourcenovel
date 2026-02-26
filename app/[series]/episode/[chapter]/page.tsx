"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { loadEpisodeChapterData } from "@/lib/episode-data";
import type { EpisodeChapterData } from "@/lib/episode-types";
import { EpisodePlayer } from "@/components/episode-player";

export default function EpisodeChapterPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const seriesId = params.series as string;
  const chapterNum = parseInt(params.chapter as string, 10);
  const replaySessionId = searchParams.get("session");

  const [chapterData, setChapterData] = useState<EpisodeChapterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNaN(chapterNum)) {
      setError("Invalid chapter number");
      setLoading(false);
      return;
    }

    loadEpisodeChapterData(seriesId, chapterNum)
      .then((data) => {
        if (!data || data.beats.length === 0) {
          setError("No episode data available");
          return;
        }
        setChapterData(data);
      })
      .catch(() => setError("Failed to load episode"))
      .finally(() => setLoading(false));
  }, [seriesId, chapterNum]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading episode...</p>
        </div>
      </div>
    );
  }

  if (error || !chapterData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <p className="text-slate-400 mb-4">{error || "Something went wrong"}</p>
          <button
            onClick={() => router.push(`/${seriesId}`)}
            className="text-violet-400 hover:text-violet-300 text-sm transition-colors"
          >
            Back to series
          </button>
        </div>
      </div>
    );
  }

  return (
    <EpisodePlayer
      chapterData={chapterData}
      seriesId={seriesId}
      onClose={() => router.push(`/${seriesId}`)}
      replaySessionId={replaySessionId}
    />
  );
}

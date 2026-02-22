"use client";

import { useState, useRef, useEffect } from "react";
import { PlayIcon } from "@heroicons/react/24/solid";
import { VideoCameraIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { ChapterVideo } from "@/lib/series";

interface VideoFeedProps {
  videos: ChapterVideo[];
}

export function VideoFeed({ videos }: VideoFeedProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [format, setFormat] = useState<"desktop" | "mobile">("desktop");
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedIndex !== null && playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedIndex]);

  if (videos.length === 0) {
    return (
      <div className="text-center py-16">
        <VideoCameraIcon className="w-10 h-10 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-600 text-sm">No videos available yet</p>
      </div>
    );
  }

  const selected = selectedIndex !== null ? videos[selectedIndex] : null;
  const selectedSrc = selected
    ? (format === "desktop" ? selected.desktopSrc : selected.mobileSrc)
    : null;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Thumbnail grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {videos.map((video, index) => (
          <button
            key={video.chapterNumber}
            onClick={() => setSelectedIndex(selectedIndex === index ? null : index)}
            className={`group text-left rounded-lg overflow-hidden transition-all ${
              selectedIndex === index
                ? "ring-2 ring-violet-500/70"
                : "ring-1 ring-slate-800/60 hover:ring-slate-700"
            }`}
          >
            <div className="relative aspect-video bg-slate-900">
              {video.thumbnail ? (
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <VideoCameraIcon className="w-8 h-8 text-slate-800" />
                </div>
              )}
              {/* Play overlay */}
              <div className={`absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity ${
                selectedIndex === index
                  ? "opacity-0"
                  : "opacity-0 group-hover:opacity-100"
              }`}>
                <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                  <PlayIcon className="w-5 h-5 text-white ml-0.5" />
                </div>
              </div>
              {/* Active indicator */}
              {selectedIndex === index && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-violet-500" />
              )}
            </div>
            <div className="px-2.5 py-2 bg-slate-900/60">
              <p className="text-xs text-slate-400 truncate">
                <span className="text-slate-600 tabular-nums">{String(video.chapterNumber).padStart(2, "0")}</span>
                {" "}{video.title}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Expanded player */}
      {selected && selectedSrc && (
        <div ref={playerRef} className="animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-slate-600 tabular-nums">{String(selected.chapterNumber).padStart(2, "0")}</span>
              <h3 className="text-sm text-slate-300">{selected.title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setFormat("desktop")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    format === "desktop" ? "text-slate-200" : "text-slate-600 hover:text-slate-400"
                  }`}
                >
                  16:9
                </button>
                <span className="text-slate-700">/</span>
                <button
                  onClick={() => setFormat("mobile")}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    format === "mobile" ? "text-slate-200" : "text-slate-600 hover:text-slate-400"
                  }`}
                >
                  9:16
                </button>
              </div>
              <button
                onClick={() => setSelectedIndex(null)}
                className="p-1 rounded text-slate-600 hover:text-slate-400 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className={`rounded-lg overflow-hidden bg-black ${format === "mobile" ? "flex justify-center" : ""}`}>
            <video
              key={`${selected.chapterNumber}-${format}`}
              src={selectedSrc}
              controls
              autoPlay
              preload="metadata"
              playsInline
              className={format === "mobile" ? "h-[70vh] max-w-full" : "w-full aspect-video"}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}
    </div>
  );
}

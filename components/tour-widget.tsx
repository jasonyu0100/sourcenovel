"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  BookOpenIcon,
  PhotoIcon,
  ChevronRightIcon,
  PlayIcon,
  VideoCameraIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  HeartIcon,
  MapIcon,
} from "@heroicons/react/24/outline";
import type { SeriesEntry, PageImage } from "@/lib/types";
import {
  getSeriesManifest,
  discoverChapters,
  getAllPageImages,
  getContentManifest,
  getAllChapterVideos,
  type ChapterVideo,
} from "@/lib/series";
import { loadAllEpisodeChapterSummaries } from "@/lib/episode-data";

export function TourWidget() {
  const pathname = usePathname();
  const [entry, setEntry] = useState<SeriesEntry | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [chapterCount, setChapterCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [episodeCount, setEpisodeCount] = useState(0);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    getSeriesManifest().then(async (series) => {
      if (!series) return;
      if (!series.chapters || series.chapters.length === 0) {
        series.chapters = await discoverChapters(series.id);
      }
      setEntry(series);
      setChapterCount(series.chapters?.length ?? 0);

      const contentManifest = await getContentManifest(series.id);
      const chapters = series.chapters || [];

      const [pages, videos, episodes] = await Promise.all([
        getAllPageImages(series.id, chapters),
        contentManifest
          ? getAllChapterVideos(series.id, contentManifest)
          : Promise.resolve([]),
        loadAllEpisodeChapterSummaries(series.id),
      ]);

      setPageCount(pages.length);
      setVideoCount(videos.length);
      setEpisodeCount(episodes.length);
    });
  }, []);

  // Show on series home pages (e.g., /ignition) but not on root or sub-pages
  const pathSegments = pathname.split("/").filter(Boolean);
  const isSeriesHomePage = pathname !== "/" && pathSegments.length === 1;
  const seriesId = pathSegments[0];
  if (!entry || !isSeriesHomePage) return null;

  const steps: {
    icon: React.ReactNode;
    title: string;
    desc: string;
    href: string;
    external?: boolean;
  }[] = [];

  if (episodeCount > 0) {
    steps.push({
      icon: <PlayIcon className="w-4 h-4 text-emerald-400" />,
      title: "Play Episode 1",
      desc: "Interactive story experience",
      href: `/${seriesId}/episode/1`,
    });
  }

  if (pageCount > 0) {
    steps.push({
      icon: <PhotoIcon className="w-4 h-4 text-cyan-400" />,
      title: "Read the Pages",
      desc: `${pageCount} manga pages`,
      href: `/${seriesId}?openReader=true`,
    });
  }

  if (chapterCount > 0) {
    steps.push({
      icon: <BookOpenIcon className="w-4 h-4 text-violet-400" />,
      title: "Browse Chapters",
      desc: `${chapterCount} chapters`,
      href: `/${seriesId}?view=chapters`,
    });
  }

  if (videoCount > 0) {
    steps.push({
      icon: <VideoCameraIcon className="w-4 h-4 text-rose-400" />,
      title: "Watch Videos",
      desc: `${videoCount} narrated videos`,
      href: `/${seriesId}?view=videos`,
    });
  }

  steps.push({
    icon: <DocumentTextIcon className="w-4 h-4 text-amber-400" />,
    title: "Explore Sources",
    desc: "Lore and world-building",
    href: `/${seriesId}/sources`,
  });

  steps.push({
    icon: <GlobeAltIcon className="w-4 h-4 text-sky-400" />,
    title: "View the Web",
    desc: "Story structure tree",
    href: `/${seriesId}/web`,
  });

  if (entry.donationLink) {
    steps.push({
      icon: <HeartIcon className="w-4 h-4 text-pink-400" />,
      title: "Support the Project",
      desc: "Help keep the story going",
      href: entry.donationLink,
      external: true,
    });
  }

  return (
    <div className="hidden sm:block fixed bottom-14 right-14 z-[10001]">
      {/* Expanded panel */}
      {showTour && (
        <div className="absolute bottom-14 right-0 w-80 bg-[#0e0e18]/95 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden animate-fade-in mb-2">
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800/50">
            <div className="flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-white">Explore</span>
            </div>
            <button
              onClick={() => setShowTour(false)}
              className="p-1 text-slate-500 hover:text-white rounded transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
          <div className="p-2 max-h-[50vh] overflow-y-auto space-y-0.5">
            {steps.map((step, i) => {
              const inner = (
                <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/60 transition-all cursor-pointer">
                  <div className="w-6 h-6 rounded-md bg-slate-800/80 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-slate-500">
                      {i + 1}
                    </span>
                  </div>
                  <div className="flex items-center justify-center flex-shrink-0">
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                      {step.title}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {step.desc}
                    </div>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0 group-hover:translate-x-0.5 transition-all" />
                </div>
              );

              if (step.external) {
                return (
                  <a
                    key={i}
                    href={step.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {inner}
                  </a>
                );
              }
              return (
                <Link key={i} href={step.href}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setShowTour(!showTour)}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
          showTour
            ? "bg-violet-500 hover:bg-violet-400 text-white shadow-[0_0_24px_rgba(139,92,246,0.6)] hover:shadow-[0_0_32px_rgba(139,92,246,0.8)]"
            : "bg-violet-600/80 hover:bg-violet-500 border border-violet-400/30 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)] hover:shadow-[0_0_28px_rgba(139,92,246,0.7)]"
        }`}
        title="Tour"
      >
        <MapIcon className="w-6 h-6" />
      </button>
    </div>
  );
}

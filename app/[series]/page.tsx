"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { BookOpenIcon, MusicalNoteIcon, PhotoIcon, ChevronRightIcon, ClockIcon, EllipsisHorizontalIcon, ArrowDownTrayIcon, PlayIcon, ArrowLeftIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import type { SeriesEntry, PageImage } from "@/lib/types";
import { getSeriesEntry, getMusicPath, getAllPageImages, getAllChapterInfo, getContentManifest, getAllChapterVideos, type ChapterInfo, type ChapterVideo } from "@/lib/series";
import { ImageFeed } from "@/components/image-feed";
import { VideoFeed } from "@/components/video-feed";
import { MangaReader } from "@/components/manga-reader";
import { generateEpub, downloadEpub } from "@/lib/epub";
import { loadAllEpisodeChapterSummaries } from "@/lib/episode-data";
import { API_BASE } from "@/lib/constants";
import { TourWidget } from "@/components/tour-widget";

type TabType = "gallery" | "chapters" | "videos" | "episodes" | "related";

interface ChapterMedia {
  hasMusic: boolean;
  pageCount: number;
}

export default function SeriesPage() {
  return (
    <Suspense>
      <SeriesPageContent />
    </Suspense>
  );
}

function SeriesPageContent() {
  const params = useParams();
  const seriesId = params.series as string;

  const [entry, setEntry] = useState<SeriesEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [introReady, setIntroReady] = useState(false);
  const [chapterMedia, setChapterMedia] = useState<Record<number, ChapterMedia>>({});
  const [chapterInfo, setChapterInfo] = useState<ChapterInfo[]>([]);
  const [allPages, setAllPages] = useState<PageImage[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("episodes");
  const [chapterVideos, setChapterVideos] = useState<ChapterVideo[]>([]);
  const [episodeChapters, setEpisodeChapters] = useState<{ chapterNum: number; title: string; pageCount: number; thumbnail: string | null }[]>([]);
  const [hasEpisodes, setHasEpisodes] = useState(false);
  const [hasPages, setHasPages] = useState(false);
  const [hasWorldMap, setHasWorldMap] = useState(false);
  const [openPagesOnLoad, setOpenPagesOnLoad] = useState(false);
  const [generatingEpub, setGeneratingEpub] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [mangaReaderOpen, setMangaReaderOpen] = useState(false);
  const [mangaReaderStartIndex, setMangaReaderStartIndex] = useState(0);
  const [savedPageIndex, setSavedPageIndex] = useState<number | null>(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    const view = searchParams.get("view");
    if (view && ["gallery", "chapters", "videos", "episodes", "related"].includes(view)) {
      setActiveTab(view as TabType);
      setShowIntro(false);
    }
    // Handle openReader query param
    if (searchParams.get("openReader") === "true") {
      setShowIntro(false);
      setOpenPagesOnLoad(true);
    }
  }, [searchParams, seriesId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSeriesData() {
      try {
        const series = await getSeriesEntry(seriesId);
        if (cancelled) return;

        if (series) {
          setEntry(series);

          // Quick existence checks for intro screen
          const firstChapter = (series.chapters || [])[0];
          try {
            const checks: Promise<unknown>[] = [
              fetch(`${API_BASE}/${seriesId}/world/world-map.json`, { method: "HEAD" })
                .then(r => { if (r.ok) setHasWorldMap(true); })
                .catch(() => {}),
            ];
            if (firstChapter) {
              checks.push(
                fetch(`${API_BASE}/${seriesId}/chapters/${firstChapter}/episode.json`, { method: "HEAD" })
                  .then(r => { if (r.ok) setHasEpisodes(true); })
                  .catch(() => {}),
                fetch(`${API_BASE}/${seriesId}/manifest.json`).then(r => r.ok ? r.json() : null)
                  .then(manifestRes => {
                    if (manifestRes?.chapters?.some((c: { pages?: (number | { number: number })[] }) => c.pages && c.pages.length > 0)) {
                      setHasPages(true);
                    }
                  })
                  .catch(() => {}),
              );
            }
            await Promise.all(checks);
          } catch {}

          setIntroReady(true);

          // Phase 2: Load all data in parallel
          const contentManifest = await getContentManifest(seriesId);
          const chapters = series.chapters || [];

          const mediaStatus: Record<number, ChapterMedia> = {};
          const [pages, info, videos, episodeSummaries] = await Promise.all([
            getAllPageImages(seriesId, chapters),
            getAllChapterInfo(seriesId, chapters),
            contentManifest ? getAllChapterVideos(seriesId, contentManifest) : Promise.resolve([]),
            loadAllEpisodeChapterSummaries(seriesId),
            ...chapters.map(async (chapterNum: number) => {
              const chapter = contentManifest?.chapters.find(c => c.number === chapterNum);
              const pageCount = chapter?.pages?.length || 0;
              let hasMusic = false;
              try {
                const res = await fetch(getMusicPath(seriesId, chapterNum), { method: "HEAD" });
                hasMusic = res.ok;
              } catch {}
              mediaStatus[chapterNum] = { hasMusic, pageCount };
            }),
          ]);

          if (cancelled) return;
          setAllPages(pages);
          setChapterInfo(info);
          setChapterVideos(videos);
          setEpisodeChapters(episodeSummaries);
          setChapterMedia(mediaStatus);
        }
      } catch (err) {
        console.error("Failed to load series data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSeriesData();

    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  useEffect(() => {
    const savedPg = localStorage.getItem(`savedMangaPageIndex_${seriesId}`);
    if (savedPg) setSavedPageIndex(parseInt(savedPg, 10));
  }, [seriesId]);

  // Open manga reader after pages load if requested from intro
  useEffect(() => {
    if (openPagesOnLoad && allPages.length > 0) {
      setOpenPagesOnLoad(false);
      openMangaReader(savedPageIndex !== null && savedPageIndex > 0 ? savedPageIndex : 0);
    }
  }, [openPagesOnLoad, allPages, savedPageIndex]);

  const handleMangaPageChange = (index: number) => {
    setSavedPageIndex(index);
    localStorage.setItem(`savedMangaPageIndex_${seriesId}`, index.toString());
  };

  const openMangaReader = (startIndex: number) => {
    setMangaReaderStartIndex(startIndex);
    setMangaReaderOpen(true);
    handleMangaPageChange(startIndex);
  };

  const dismissIntro = () => {
    setShowIntro(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Immersive intro screen
  if (showIntro && entry) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0a0a0f] flex items-center justify-center overflow-hidden">
        {/* Back button */}
        <Link
          href="/"
          className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-sm transition-all"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span className="hidden sm:inline">All Series</span>
        </Link>

        {entry.background || entry.cover ? (
          <>
            <img
              src={`${API_BASE}/${seriesId}/${entry.background || entry.cover}`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-0 scale-110 transition-all duration-[3s] ease-out"
              style={introReady ? { opacity: 0.4, transform: "scale(1.05)" } : {}}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/70 to-[#0a0a0f]/40" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f]/50 via-transparent to-[#0a0a0f]/50" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 to-[#0a0a0f]" />
        )}

        <div className="relative z-10 max-w-lg mx-auto px-6 text-center">
          {introReady && entry.cover && (
            <div className="mb-8 animate-fade-in">
              <img
                src={`${API_BASE}/${seriesId}/${entry.cover}`}
                alt={entry.title}
                className="w-36 aspect-[2/3] mx-auto rounded-xl object-cover shadow-2xl border border-white/10"
              />
            </div>
          )}

          {introReady ? (
            <div className="animate-fade-in" style={{ animationDelay: "0.3s", animationFillMode: "both" }}>
              <p className="text-violet-400 text-xs font-medium tracking-widest uppercase mb-3">{entry.genre}</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight mb-4">{entry.title}</h1>
              {entry.description && (
                <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto mb-8">
                  {entry.description}
                </p>
              )}
            </div>
          ) : (
            <div className="mb-8">
              <div className="w-8 h-8 mx-auto border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            </div>
          )}

          {introReady && (
            <div className="animate-fade-in flex flex-col items-center gap-3 mt-8" style={{ animationDelay: "0.6s", animationFillMode: "both" }}>
              {hasEpisodes && (
                <Link
                  href={`/${seriesId}/episode/1`}
                  className="inline-flex items-center justify-center gap-2 w-full max-w-xs px-8 py-3 rounded-full bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-300 hover:text-white text-sm font-medium shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all duration-300"
                >
                  <PlayIcon className="w-5 h-5" />
                  Begin Episode 1
                </Link>
              )}
              {hasWorldMap && (
                <Link
                  href={`/${seriesId}/world`}
                  className="inline-flex items-center justify-center gap-2 w-full max-w-xs px-8 py-3 rounded-full bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 hover:text-white text-sm font-medium shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all duration-300"
                >
                  <GlobeAltIcon className="w-5 h-5" />
                  Explore World
                </Link>
              )}
              <button
                onClick={dismissIntro}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-slate-500 hover:text-slate-300 text-xs transition-all"
              >
                Browse Series
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center py-20 animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-center">
            <BookOpenIcon className="w-10 h-10 text-slate-600" />
          </div>
          <h2 className="text-xl text-slate-300 mb-3">Series not found</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
            The series <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{seriesId}</code> does not exist.
          </p>
          <Link href="/" className="mt-6 inline-block text-violet-400 hover:text-violet-300 text-sm">
            ← Back to series list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero header with background */}
      <header className="relative">
        {/* Back button */}
        <Link
          href="/"
          className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3 py-2 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm border border-white/10 text-slate-300 hover:text-white text-sm transition-all"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span className="hidden sm:inline">All Series</span>
        </Link>

        <div className="absolute inset-0 overflow-hidden">
          {(entry.background || entry.cover) ? (
            <>
              <img
                src={`${API_BASE}/${seriesId}/${entry.background || entry.cover}`}
                alt=""
                className="w-full h-full object-cover scale-105 opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/30 via-[#0a0a0f]/60 to-[#0a0a0f]" />
              <div className="absolute inset-0 bg-gradient-to-r from-violet-950/20 via-transparent to-violet-950/20" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-slate-900/50 to-[#0a0a0f]" />
          )}
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16">
          <div className="flex gap-10 items-center animate-fade-in">
            {entry.cover && (
              hasEpisodes ? (
                <Link
                  href={`/${seriesId}/episode/1`}
                  className="hidden sm:block w-48 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl flex-shrink-0 border border-violet-400/30 glow-violet-pulse hover:scale-[1.03] transition-transform duration-300"
                >
                  <img
                    src={`${API_BASE}/${seriesId}/${entry.cover}`}
                    alt={entry.title}
                    className="w-full h-full object-cover"
                  />
                </Link>
              ) : (
                <div className="hidden sm:block w-48 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl flex-shrink-0 border border-white/10 glow-violet">
                  <img
                    src={`${API_BASE}/${seriesId}/${entry.cover}`}
                    alt={entry.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )
            )}

            <div className="flex-1">
              <p className="text-violet-400 text-sm font-medium tracking-wide uppercase mb-3">{entry.genre}</p>
              <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight">{entry.title}</h1>

              {entry.author && (
                <p className="text-slate-400 mt-4">
                  by {entry.author.email ? (
                    <a href={`mailto:${entry.author.email}`} className="text-violet-400 hover:text-violet-300 transition-colors font-medium">{entry.author.name}</a>
                  ) : (
                    <span className="text-slate-300 font-medium">{entry.author.name}</span>
                  )}
                </p>
              )}

              {entry.description && (
                <p className="text-slate-400 text-sm leading-relaxed mt-5 max-w-xl">
                  {entry.description}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {allPages.length > 0 && (
                  <button
                    onClick={() => openMangaReader(savedPageIndex !== null && savedPageIndex > 0 ? savedPageIndex : 0)}
                    className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-base text-white font-medium transition-all bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 ${
                      savedPageIndex !== null && savedPageIndex > 0
                        ? "shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.7)]"
                        : "shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40"
                    }`}
                  >
                    <BookOpenIcon className="w-5 h-5" />
                    {savedPageIndex !== null && savedPageIndex > 0 ? "Resume Pages" : "Read Pages"}
                  </button>
                )}
                {episodeChapters.length > 0 && (
                  <Link
                    href={`/${seriesId}/episode/1`}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.35)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all"
                    title="Start Episode"
                  >
                    <PlayIcon className="w-5 h-5" />
                  </Link>
                )}
                {hasWorldMap && (
                  <Link
                    href={`/${seriesId}/world`}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-400 shadow-[0_0_14px_rgba(139,92,246,0.25)] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all"
                    title="Explore World"
                  >
                    <GlobeAltIcon className="w-5 h-5" />
                  </Link>
                )}
                {(entry.chapters?.length ?? 0) > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                      className="inline-flex items-center justify-center w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full text-white/70 hover:text-white transition-all"
                      title="More options"
                    >
                      <EllipsisHorizontalIcon className="w-5 h-5" />
                    </button>
                    {moreMenuOpen && (
                      <>
                        <div className="fixed inset-0" onClick={() => setMoreMenuOpen(false)} />
                        <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-10 overflow-hidden">
                          <button
                            onClick={async () => {
                              if (generatingEpub) return;
                              setMoreMenuOpen(false);
                              setGeneratingEpub(true);
                              try {
                                const blob = await generateEpub({
                                  seriesId: entry.id,
                                  title: entry.title,
                                  author: entry.author?.name || 'Unknown',
                                  chapters: entry.chapters || [],
                                  cover: entry.cover,
                                });
                                const filename = entry.title.toLowerCase().replace(/\s+/g, '-') + '.epub';
                                downloadEpub(blob, filename);
                              } catch (error) {
                                console.error('Failed to generate EPUB:', error);
                              } finally {
                                setGeneratingEpub(false);
                              }
                            }}
                            disabled={generatingEpub}
                            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4 text-emerald-400" />
                            {generatingEpub ? "Generating..." : "Download EPUB"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Tabs */}
        <div className="mb-8 -mx-6 px-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 sm:gap-8 min-w-max">
            <button
              onClick={() => setActiveTab("episodes")}
              className={`pb-2 text-base sm:text-lg font-medium transition-all border-b-2 -mb-px ${
                activeTab === "episodes"
                  ? "text-white border-violet-500"
                  : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
            >
              Episodes
            </button>
            <button
              onClick={() => setActiveTab("gallery")}
              className={`pb-2 text-base sm:text-lg font-medium transition-all border-b-2 -mb-px ${
                activeTab === "gallery"
                  ? "text-white border-violet-500"
                  : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
            >
              Pages
            </button>
            <button
              onClick={() => setActiveTab("chapters")}
              className={`pb-2 text-base sm:text-lg font-medium transition-all border-b-2 -mb-px ${
                activeTab === "chapters"
                  ? "text-white border-violet-500"
                  : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
            >
              Chapters
            </button>
            <button
              onClick={() => setActiveTab("videos")}
              className={`pb-2 text-base sm:text-lg font-medium transition-all border-b-2 -mb-px ${
                activeTab === "videos"
                  ? "text-white border-violet-500"
                  : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
            >
              Videos
            </button>
            <div className="hidden sm:block w-px bg-slate-700/50 self-stretch my-1" />
            <Link
              href={`/${seriesId}/sources`}
              className="hidden sm:block pb-2 text-base sm:text-lg font-medium transition-all border-b-2 -mb-px text-slate-500 border-transparent hover:text-slate-300"
            >
              Sources
            </Link>
            <Link
              href={`/${seriesId}/web`}
              className="hidden sm:block pb-2 text-base sm:text-lg font-medium transition-all border-b-2 -mb-px text-slate-500 border-transparent hover:text-slate-300"
            >
              Web
            </Link>
          </div>
        </div>

        {/* Pages Tab */}
        {activeTab === "gallery" && allPages.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <PhotoIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No pages yet</p>
          </div>
        )}
        {activeTab === "gallery" && allPages.length > 0 && (
          <div className="animate-fade-in">
            <ImageFeed
              images={allPages}
              columns={3}
              collapsedRows={2}
              onImageClick={(image) => {
                const idx = allPages.findIndex(
                  (p) => p.chapterNum === image.chapterNum && p.pageNum === image.pageNum
                );
                openMangaReader(idx >= 0 ? idx : 0);
              }}
            />
          </div>
        )}

        {/* Chapters Tab */}
        {activeTab === "chapters" && (entry.chapters || []).length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <BookOpenIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No chapters yet</p>
          </div>
        )}
        {activeTab === "chapters" && (entry.chapters || []).length > 0 && (
          <div className="space-y-2 stagger-children animate-fade-in">
            {(entry.chapters || []).map((chapterNum, index) => {
              const media = chapterMedia[chapterNum];
              const info = chapterInfo.find(c => c.number === chapterNum);
              const isLatest = index === (entry.chapters || []).length - 1;
              return (
                <Link
                  key={chapterNum}
                  href={`/${seriesId}/chapter/${chapterNum}`}
                  className={`group flex items-center justify-between rounded-xl p-4 transition-all duration-200 card-hover ${
                    isLatest
                      ? "bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/30 hover:border-violet-500/50"
                      : "bg-slate-900/40 hover:bg-slate-800/50 border border-slate-800/50 hover:border-violet-500/30"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                      isLatest
                        ? "bg-violet-600/30 border border-violet-500/50 group-hover:bg-violet-600/40"
                        : "bg-slate-800/50 group-hover:bg-violet-600/20 border border-slate-700/50 group-hover:border-violet-500/30"
                    }`}>
                      <span className={`text-sm font-semibold transition-colors ${
                        isLatest ? "text-violet-300" : "text-slate-400 group-hover:text-violet-400"
                      }`}>
                        {chapterNum}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium transition-colors ${
                          isLatest ? "text-violet-200 group-hover:text-white" : "text-slate-200 group-hover:text-white"
                        }`}>
                          {info?.title || `Chapter ${chapterNum}`}
                        </span>
                        {isLatest && (
                          <span className="px-1.5 py-0.5 bg-violet-500/20 border border-violet-500/30 rounded text-[10px] uppercase tracking-wider text-violet-300 font-medium">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">Chapter {chapterNum}</span>
                        {info?.readingTime && (
                          <>
                            <span className="text-slate-700">·</span>
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <ClockIcon className="w-3 h-3" />
                              {info.readingTime} min
                            </span>
                          </>
                        )}
                        {(media?.pageCount > 0 || media?.hasMusic) && (
                          <>
                            <span className="text-slate-700">·</span>
                            {media?.pageCount > 0 && (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <PhotoIcon className="w-3 h-3" />
                                {media.pageCount} pg
                              </span>
                            )}
                            {media?.hasMusic && (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <MusicalNoteIcon className="w-3 h-3" />
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRightIcon className={`w-5 h-5 group-hover:translate-x-0.5 transition-all ${
                    isLatest ? "text-violet-400" : "text-slate-600 group-hover:text-violet-400"
                  }`} />
                </Link>
              );
            })}
          </div>
        )}

        {/* Videos Tab */}
        {activeTab === "videos" && (
          <div className="animate-fade-in">
            <VideoFeed videos={chapterVideos} />
          </div>
        )}

        {/* Episodes Tab */}
        {activeTab === "episodes" && episodeChapters.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <PlayIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No interactive chapters available yet</p>
          </div>
        )}
        {activeTab === "episodes" && episodeChapters.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            {episodeChapters.map((chapter, index) => {
              const isLatest = index === episodeChapters.length - 1;
              return (
                <Link
                  key={chapter.chapterNum}
                  href={`/${seriesId}/episode/${chapter.chapterNum}`}
                  className={`group flex items-center gap-4 rounded-xl p-4 transition-all duration-200 card-hover ${
                    isLatest
                      ? "bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/30 hover:border-violet-500/50"
                      : "bg-slate-900/40 hover:bg-slate-800/50 border border-slate-800/50 hover:border-violet-500/30"
                  }`}
                >
                  {chapter.thumbnail && (
                    <div className="w-24 h-16 sm:w-32 sm:h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800">
                      <img
                        src={chapter.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium transition-colors ${
                        isLatest ? "text-violet-200 group-hover:text-white" : "text-slate-200 group-hover:text-white"
                      }`}>
                        {chapter.title}
                      </span>
                      {isLatest && (
                        <span className="px-1.5 py-0.5 bg-violet-500/20 border border-violet-500/30 rounded text-[10px] uppercase tracking-wider text-violet-300 font-medium">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">Episode {chapter.chapterNum}</span>
                      <span className="text-slate-700">&middot;</span>
                      <span className="text-xs text-slate-500">{chapter.pageCount} pages</span>
                    </div>
                  </div>

                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isLatest
                      ? "bg-emerald-600/30 border border-emerald-500/50 group-hover:bg-emerald-600/40 shadow-[0_0_14px_rgba(16,185,129,0.35)] group-hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                      : "bg-emerald-600/20 group-hover:bg-emerald-600/30 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)] group-hover:shadow-[0_0_16px_rgba(16,185,129,0.35)]"
                  }`}>
                    <PlayIcon className="w-5 h-5 text-emerald-400" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/30 mt-8">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center space-y-3">
          {entry.donationLink && (
            <a
              href={entry.donationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-sm transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 01-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 013.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 01-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 01-4.743.295 37.059 37.059 0 01-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0011.343.376.483.483 0 01.535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 01.39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 01-.169.364zm-6.159 3.9c-.862.37-1.84.788-3.109.788a5.884 5.884 0 01-1.569-.217l.877 9.004c.065.78.717 1.38 1.5 1.38 0 0 1.243.065 1.658.065.447 0 1.786-.065 1.786-.065.783 0 1.434-.6 1.499-1.38l.94-9.95a3.996 3.996 0 00-1.322-.238c-.826 0-1.491.284-2.26.613z"/>
              </svg>
              Support this project
            </a>
          )}
          <p className="text-xs text-slate-600">
            Powered by <a href="https://github.com/jasonyu0100/web-novel-template" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-400 transition-colors">Web Novel Template</a>
          </p>
        </div>
      </footer>

      <MangaReader
        pages={allPages}
        isOpen={mangaReaderOpen}
        onClose={() => setMangaReaderOpen(false)}
        seriesTitle={entry.title}
        startIndex={mangaReaderStartIndex}
        onPageChange={handleMangaPageChange}
        donationLink={entry.donationLink}
        seriesId={seriesId}
        chapterMusic={Object.fromEntries(
          Object.entries(chapterMedia).map(([k, v]) => [k, v.hasMusic])
        )}
      />
      <TourWidget />
    </div>
  );
}

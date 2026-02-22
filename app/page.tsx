"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpenIcon, ChevronLeftIcon, ChevronRightIcon, PlayIcon } from "@heroicons/react/24/outline";
import type { SeriesEntry } from "@/lib/types";
import { getSeriesList } from "@/lib/series";
import { API_BASE } from "@/lib/constants";

export default function HomePage() {
  const [seriesList, setSeriesList] = useState<SeriesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSeriesList()
      .then((list) => {
        setSeriesList(list);
        if (list.length === 1) {
          router.replace(`/${list[0].id}`);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const scrollToIndex = (index: number) => {
    const newIndex = Math.max(0, Math.min(index, seriesList.length - 1));
    setActiveIndex(newIndex);
    if (carouselRef.current) {
      const card = carouselRef.current.children[newIndex] as HTMLElement;
      if (card) {
        card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  };

  const nextSlide = () => scrollToIndex(activeIndex + 1);
  const prevSlide = () => scrollToIndex(activeIndex - 1);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Single series - redirect
  if (seriesList.length === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  // No series
  if (seriesList.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center py-20 animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-center">
            <BookOpenIcon className="w-10 h-10 text-slate-600" />
          </div>
          <h2 className="text-xl text-slate-300 mb-3">No stories yet</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
            Add a series by creating a folder in <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">series/</code> and running{" "}
            <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">npm run sync</code>
          </p>
        </div>
      </div>
    );
  }

  const activeSeries = seriesList[activeIndex];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Hero Background from active series */}
      <div className="fixed inset-0 z-0">
        {(activeSeries?.background || activeSeries?.cover) && (
          <>
            <img
              key={activeSeries.id}
              src={`${API_BASE}/${activeSeries.id}/${activeSeries.background || activeSeries.cover}`}
              alt=""
              className="w-full h-full object-cover opacity-20 scale-105 transition-opacity duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/80 to-[#0a0a0f]/60" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f]/50 via-transparent to-[#0a0a0f]/50" />
          </>
        )}
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/source-novel-icon.png" alt="SourceNovel" className="w-8 h-8 rounded-lg" />
            <div>
              <h1 className="text-xl font-bold text-white">SourceNovel</h1>
              <p className="text-xs text-slate-500">Generative Fiction</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col py-8">
        {/* Series Carousel */}
        <div className="relative">
          {/* Navigation Arrows */}
          {seriesList.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                disabled={activeIndex === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
              <button
                onClick={nextSlide}
                disabled={activeIndex === seriesList.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Carousel Container */}
          <div
            ref={carouselRef}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-[calc(50vw-180px)] sm:px-[calc(50vw-220px)] py-4"
            onScroll={(e) => {
              const container = e.currentTarget;
              const scrollLeft = container.scrollLeft;
              const cardWidth = container.firstElementChild?.clientWidth || 360;
              const gap = 24;
              const newIndex = Math.round(scrollLeft / (cardWidth + gap));
              if (newIndex !== activeIndex && newIndex >= 0 && newIndex < seriesList.length) {
                setActiveIndex(newIndex);
              }
            }}
          >
            {seriesList.map((series, index) => (
              <div
                key={series.id}
                onClick={() => {
                  if (index !== activeIndex) {
                    scrollToIndex(index);
                  }
                }}
                className={`group relative flex-shrink-0 w-[360px] sm:w-[440px] aspect-[3/4] rounded-2xl overflow-hidden snap-start transition-all duration-500 ${
                  index === activeIndex
                    ? "scale-100 opacity-100 shadow-2xl shadow-violet-500/20"
                    : "scale-95 opacity-50 cursor-pointer"
                }`}
              >
                {/* Card Background */}
                {series.cover ? (
                  <img
                    src={`${API_BASE}/${series.id}/${series.cover}`}
                    alt={series.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                {/* Content */}
                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                  <p className="text-violet-400 text-xs font-medium tracking-widest uppercase mb-2">
                    {series.genre}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight">
                    {series.title}
                  </h2>
                  {series.description && (
                    <p className="text-slate-300 text-sm leading-relaxed line-clamp-2 mb-4">
                      {series.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/${series.id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-medium hover:bg-violet-600/80 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PlayIcon className="w-4 h-4" />
                      Start Reading
                    </Link>
                  </div>
                </div>

                {/* Border glow on active */}
                {index === activeIndex && (
                  <div className="absolute inset-0 rounded-2xl border-2 border-violet-500/30 pointer-events-none" />
                )}
              </div>
            ))}
          </div>

          {/* Dots Indicator */}
          {seriesList.length > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {seriesList.map((_, index) => (
                <button
                  key={index}
                  onClick={() => scrollToIndex(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === activeIndex
                      ? "w-8 bg-violet-500"
                      : "w-2 bg-slate-600 hover:bg-slate-500"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Active Series Info */}
        <div className="text-center mt-8 px-6">
          <p className="text-slate-500 text-sm">
            {activeIndex + 1} of {seriesList.length} stories
          </p>
        </div>

        {/* Below Carousel Content */}
        <div className="w-full max-w-2xl self-center px-4 mt-16 mb-8 space-y-12">
          {/* Getting Started */}
          <section>
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Create Your Own</h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              Generative Fiction — stories co-created by humans and AI. Clone the repo, add your API keys, and use Claude Code skills to write, illustrate, and publish your own visual novel.
            </p>

            {/* Setup */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-300 mb-2">1. Clone and install</p>
                <pre className="text-[11px] text-slate-400 bg-white/[0.03] border border-slate-800/50 rounded-lg px-3 py-2 overflow-x-auto">
{`git clone https://github.com/jasonyu0100/sourcenovel.git
cd sourcenovel && npm install`}
                </pre>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-300 mb-2">2. API keys</p>
                <pre className="text-[11px] text-slate-400 bg-white/[0.03] border border-slate-800/50 rounded-lg px-3 py-2 overflow-x-auto">
{`cp .env.example .env`}
                </pre>
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] text-slate-500">
                    <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noopener noreferrer" className="text-violet-400/70 hover:text-violet-400">Replicate</a> — image generation (Seedream)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-violet-400/70 hover:text-violet-400">ElevenLabs</a> — TTS narration and music
                  </p>
                  <p className="text-[11px] text-slate-500">
                    <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer" className="text-violet-400/70 hover:text-violet-400">OpenRouter</a> — interactive episode AI
                  </p>
                  <p className="text-[11px] text-slate-500">
                    <a href="https://claude.com/claude-code" target="_blank" rel="noopener noreferrer" className="text-violet-400/70 hover:text-violet-400">Claude Code</a> — runs the authoring workflow
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-300 mb-2">3. Start writing</p>
                <pre className="text-[11px] text-slate-400 bg-white/[0.03] border border-slate-800/50 rounded-lg px-3 py-2 overflow-x-auto">
{`claude                    # open Claude Code
/workflow-new-series      # create your series
/workflow-new-arc         # define your first arc
/workflow-new-chapter     # start writing`}
                </pre>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-300 mb-2">4. Pipeline</p>
                <pre className="text-[11px] text-slate-500 bg-white/[0.03] border border-slate-800/50 rounded-lg px-3 py-2 overflow-x-auto whitespace-pre">
{`memory → route → compose → review → web
                                      ↓
model → set → world → staging → pages → video → episode`}
                </pre>
                <p className="text-[11px] text-slate-500 mt-2">
                  Each step is a <code className="text-violet-400/60 bg-violet-500/5 px-1 rounded">/workflow-*</code> command. Run <code className="text-violet-400/60 bg-violet-500/5 px-1 rounded">/workflow-status</code> to see where you are.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6">
              <a
                href="https://github.com/jasonyu0100/sourcenovel"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                Full documentation on GitHub →
              </a>
              <span className="text-slate-800">·</span>
              <span className="text-xs text-slate-600">MIT License</span>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/30">
        <div className="max-w-6xl mx-auto px-6 py-6" />
      </footer>
    </div>
  );
}

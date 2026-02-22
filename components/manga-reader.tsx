"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, BookOpenIcon, MusicalNoteIcon, Bars3Icon, ArrowsUpDownIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import type { PageImage } from "@/lib/types";
import { getMusicPath } from "@/lib/series";

type Slide =
  | { type: "page"; page: PageImage }
  | { type: "donate"; chapterNum: number };

interface MangaReaderProps {
  pages: PageImage[];
  isOpen: boolean;
  onClose: () => void;
  seriesTitle?: string;
  startIndex?: number;
  onPageChange?: (index: number) => void;
  donationLink?: string;
  seriesId?: string;
  chapterMusic?: Record<number, boolean>;
}

function fadeOutAudio(audio: HTMLAudioElement, onComplete: () => void, duration = 500) {
  const startVolume = audio.volume;
  const steps = 20;
  const stepTime = duration / steps;
  let step = 0;
  const interval = setInterval(() => {
    step++;
    audio.volume = Math.max(0, startVolume * (1 - step / steps));
    if (step >= steps) {
      clearInterval(interval);
      onComplete();
    }
  }, stepTime);
}

function fadeInAudio(audio: HTMLAudioElement, targetVolume: number, duration = 500) {
  audio.volume = 0;
  const steps = 20;
  const stepTime = duration / steps;
  let step = 0;
  const interval = setInterval(() => {
    step++;
    audio.volume = Math.min(targetVolume, targetVolume * (step / steps));
    if (step >= steps) {
      clearInterval(interval);
    }
  }, stepTime);
}

export function MangaReader({
  pages,
  isOpen,
  onClose,
  seriesTitle,
  startIndex = 0,
  onPageChange,
  donationLink,
  seriesId,
  chapterMusic,
}: MangaReaderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [fadeIn, setFadeIn] = useState(true);
  const isNavigating = useRef(false);

  // Music state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [currentMusicChapter, setCurrentMusicChapter] = useState<number | null>(null);

  // View mode state
  const [viewMode, setViewMode] = useState<"stories" | "scroll">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("manga-view-mode") as "stories" | "scroll") || "scroll";
    }
    return "stories";
  });
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Build slides array: pages with donate slides inserted after each chapter
  const slides = useMemo(() => {
    if (!donationLink || pages.length === 0) {
      return pages.map((p): Slide => ({ type: "page", page: p }));
    }

    const result: Slide[] = [];
    for (let i = 0; i < pages.length; i++) {
      result.push({ type: "page", page: pages[i] });
      // Insert donate slide at chapter boundary
      const isLastPage = i === pages.length - 1;
      const isChapterEnd = !isLastPage && pages[i + 1].chapterNum !== pages[i].chapterNum;
      if (isChapterEnd || isLastPage) {
        result.push({ type: "donate", chapterNum: pages[i].chapterNum });
      }
    }
    return result;
  }, [pages, donationLink]);

  // Map a page index (used externally) to a slide index (used internally)
  const pageIndexToSlideIndex = useCallback(
    (pageIdx: number) => {
      if (!donationLink) return pageIdx;
      let slideIdx = 0;
      let pagesCount = 0;
      for (const slide of slides) {
        if (slide.type === "page") {
          if (pagesCount === pageIdx) return slideIdx;
          pagesCount++;
        }
        slideIdx++;
      }
      return 0;
    },
    [slides, donationLink]
  );

  // Map a slide index to a page index (for the external callback)
  const slideIndexToPageIndex = useCallback(
    (slideIdx: number) => {
      if (!donationLink) return slideIdx;
      let pagesCount = 0;
      for (let i = 0; i < slides.length; i++) {
        if (i === slideIdx) return Math.max(0, pagesCount - (slides[i].type === "donate" ? 1 : 0));
        if (slides[i].type === "page") pagesCount++;
      }
      return 0;
    },
    [slides, donationLink]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset to starting page when opened
  useEffect(() => {
    if (isOpen) {
      const slideIdx = pageIndexToSlideIndex(
        Math.min(Math.max(0, startIndex), pages.length - 1)
      );
      setCurrentIndex(slideIdx);
      setDisplayIndex(slideIdx);
      setFadeIn(true);
    }
  }, [isOpen, startIndex, pages.length, pageIndexToSlideIndex]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Create and manage audio element
  useEffect(() => {
    if (!isOpen) return;
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [isOpen]);

  // Reset music state when reader closes
  useEffect(() => {
    if (!isOpen) {
      setIsMusicPlaying(false);
      setMusicEnabled(false);
      setCurrentMusicChapter(null);
    }
  }, [isOpen]);

  // Switch music when chapter changes (only if user has opted in)
  useEffect(() => {
    if (!musicEnabled || !seriesId || !chapterMusic) return;
    const audio = audioRef.current;
    if (!audio) return;

    const currentSlide = slides[displayIndex];
    const chapterNum =
      currentSlide?.type === "page"
        ? currentSlide.page.chapterNum
        : currentSlide?.type === "donate"
          ? currentSlide.chapterNum
          : null;
    if (chapterNum === null) return;

    const chapterHasMusic = chapterMusic[chapterNum] ?? false;

    if (!chapterHasMusic) {
      if (isMusicPlaying) {
        fadeOutAudio(audio, () => {
          audio.pause();
          setIsMusicPlaying(false);
          setCurrentMusicChapter(null);
        });
      }
      return;
    }

    if (currentMusicChapter === chapterNum && isMusicPlaying) return;

    const newSrc = getMusicPath(seriesId, chapterNum);
    const switchToNew = () => {
      audio.src = newSrc;
      audio.currentTime = 0;
      audio.volume = 0;
      audio.play()
        .then(() => {
          fadeInAudio(audio, 0.3);
          setIsMusicPlaying(true);
          setCurrentMusicChapter(chapterNum);
        })
        .catch(() => {
          setIsMusicPlaying(false);
        });
    };

    if (isMusicPlaying) {
      fadeOutAudio(audio, switchToNew);
    } else {
      switchToNew();
    }
  }, [musicEnabled, displayIndex, seriesId, chapterMusic, slides]);

  const toggleMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !seriesId || !chapterMusic) return;

    const currentSlide = slides[displayIndex];
    const chapterNum =
      currentSlide?.type === "page"
        ? currentSlide.page.chapterNum
        : currentSlide?.type === "donate"
          ? currentSlide.chapterNum
          : null;
    if (chapterNum === null) return;

    if (isMusicPlaying) {
      fadeOutAudio(audio, () => {
        audio.pause();
        setIsMusicPlaying(false);
        setMusicEnabled(false);
      });
    } else {
      setMusicEnabled(true);
      const chapterHasMusic = chapterMusic[chapterNum] ?? false;
      if (!chapterHasMusic) return;

      const expectedSrc = getMusicPath(seriesId, chapterNum);
      if (!audio.src.endsWith(expectedSrc)) {
        audio.src = expectedSrc;
        audio.currentTime = 0;
      }
      audio.volume = 0;
      audio.play()
        .then(() => {
          fadeInAudio(audio, 0.3);
          setIsMusicPlaying(true);
          setCurrentMusicChapter(chapterNum);
        })
        .catch(() => {});
    }
  }, [isMusicPlaying, seriesId, chapterMusic, displayIndex, slides]);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === "stories" ? "scroll" : "stories";
      localStorage.setItem("manga-view-mode", next);
      return next;
    });
  }, []);

  // Scroll to current page when switching to scroll mode or opening in scroll mode
  useEffect(() => {
    if (!isOpen || viewMode !== "scroll") return;
    // Small delay to let the scroll container and page refs mount
    const timer = setTimeout(() => {
      const slideIdx = pageIndexToSlideIndex(
        Math.min(Math.max(0, startIndex), pages.length - 1)
      );
      const pageEl = pageRefs.current[slideIdx];
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "instant", block: "start" });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [viewMode, isOpen, startIndex, pages.length, pageIndexToSlideIndex]);

  // Track scroll position to update currentIndex in scroll mode
  useEffect(() => {
    if (viewMode !== "scroll" || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;

    const handleScroll = () => {
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const midpoint = containerTop + containerHeight / 3;

      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < slides.length; i++) {
        const el = pageRefs.current[i];
        if (!el) continue;
        const elTop = el.offsetTop;
        const dist = Math.abs(elTop - midpoint);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      if (closestIdx !== currentIndex) {
        setCurrentIndex(closestIdx);
        setDisplayIndex(closestIdx);
        onPageChange?.(slideIndexToPageIndex(closestIdx));
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [viewMode, currentIndex, slides.length, onPageChange, slideIndexToPageIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (viewMode === "stories") {
        if (e.key === "ArrowLeft") {
          goToPrev();
        } else if (e.key === "ArrowRight" || e.key === " ") {
          e.preventDefault();
          goToNext();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, slides.length, viewMode]);

  // Preload adjacent page images
  useEffect(() => {
    if (!isOpen || slides.length === 0) return;
    const preload = (idx: number) => {
      if (idx >= 0 && idx < slides.length) {
        const slide = slides[idx];
        if (slide.type === "page") {
          const img = new Image();
          img.src = slide.page.src;
        }
      }
    };
    preload(currentIndex + 1);
    preload(currentIndex - 1);
  }, [isOpen, currentIndex, slides]);

  const navigate = useCallback(
    (newIndex: number) => {
      if (isNavigating.current) return;
      isNavigating.current = true;

      setFadeIn(false);

      setTimeout(() => {
        setCurrentIndex(newIndex);
        setDisplayIndex(newIndex);
        setFadeIn(true);
        onPageChange?.(slideIndexToPageIndex(newIndex));

        setTimeout(() => {
          isNavigating.current = false;
        }, 300);
      }, 150);
    },
    [onPageChange, slideIndexToPageIndex]
  );

  const goToPrev = useCallback(() => {
    const newIndex = currentIndex === 0 ? slides.length - 1 : currentIndex - 1;
    navigate(newIndex);
  }, [currentIndex, slides.length, navigate]);

  const goToNext = useCallback(() => {
    const newIndex = currentIndex === slides.length - 1 ? 0 : currentIndex + 1;
    navigate(newIndex);
  }, [currentIndex, slides.length, navigate]);

  if (!mounted || !isOpen || slides.length === 0) return null;

  const currentSlide = slides[displayIndex];

  // Find the chapter number for the current slide
  const currentChapterNum =
    currentSlide.type === "page"
      ? currentSlide.page.chapterNum
      : currentSlide.chapterNum;

  // Find the nearest page image for the blurred background
  const nearestPageSrc =
    currentSlide.type === "page"
      ? currentSlide.page.src
      : (() => {
          // Look backwards for the nearest page
          for (let i = displayIndex - 1; i >= 0; i--) {
            if (slides[i].type === "page")
              return (slides[i] as { type: "page"; page: PageImage }).page.src;
          }
          return pages[0]?.src || "";
        })();

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Blurred background */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={nearestPageSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-3xl scale-125 opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
      </div>

      {/* Progress bars at top - Instagram stories style (stories mode only) */}
      {viewMode === "stories" && (
        <div className="absolute top-0 left-0 right-0 z-30 px-2 pt-2 safe-area-top">
          <div className="flex gap-1">
            {slides.map((_, idx) => (
              <div
                key={idx}
                className="h-[2px] flex-1 rounded-full overflow-hidden bg-white/30"
              >
                <div
                  className={`h-full rounded-full transition-all duration-200 ease-out ${
                    idx < currentIndex
                      ? "bg-white w-full"
                      : idx === currentIndex
                        ? "bg-white w-full"
                        : "bg-transparent w-0"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="absolute top-5 left-0 right-0 z-30 px-4 flex items-center justify-between safe-area-top">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center ring-2 ring-white/20">
            <span className="text-white text-xs font-bold">
              {currentChapterNum}
            </span>
          </div>
          <div>
            <p className="text-white text-[13px] font-semibold">
              {seriesTitle}
            </p>
            <p className="text-white/50 text-[11px]">
              Chapter {currentChapterNum}
              {currentSlide.type === "page" && ` · Page ${currentSlide.page.pageNum}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {seriesId && chapterMusic?.[currentChapterNum] && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMusic();
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isMusicPlaying
                  ? "bg-violet-500/30 text-violet-300 ring-2 ring-violet-500/40"
                  : "bg-white/10 backdrop-blur-md text-white/70 hover:bg-white/20 hover:text-white"
              }`}
              aria-label={isMusicPlaying ? "Pause music" : "Play music"}
            >
              <MusicalNoteIcon className={`w-4 h-4 ${isMusicPlaying ? "animate-music-pulse" : ""}`} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleViewMode();
            }}
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-all"
            aria-label={viewMode === "stories" ? "Switch to scroll mode" : "Switch to stories mode"}
          >
            {viewMode === "stories" ? (
              <ArrowsUpDownIcon className="w-4 h-4" />
            ) : (
              <Bars3Icon className="w-4 h-4" />
            )}
          </button>
          <Link
            href={`/chapter/${currentChapterNum}`}
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-all"
            aria-label="Read chapter"
          >
            <BookOpenIcon className="w-4 h-4" />
          </Link>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white/90 hover:bg-white/20 transition-all"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {viewMode === "stories" ? (
        <>
          {/* Main content with fade transition */}
          <div
            className={`absolute inset-0 flex items-center justify-center pt-14 pb-6 transition-opacity duration-150 ease-out ${
              fadeIn ? "opacity-100" : "opacity-0"
            }`}
          >
            {currentSlide.type === "page" ? (
              <img
                src={currentSlide.page.src}
                alt={`Chapter ${currentSlide.page.chapterNum} - Page ${currentSlide.page.pageNum}`}
                className="max-w-full max-h-full object-contain"
                style={{
                  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
                }}
              />
            ) : (
              <div
                className="rounded-2xl px-8 py-10 backdrop-blur-xl text-center max-w-sm w-full"
                style={{
                  background: "rgba(0, 0, 0, 0.5)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                }}
              >
                <p className="text-white/60 text-sm mb-2">
                  End of Chapter {currentSlide.chapterNum}
                </p>
                <p className="text-white text-lg font-semibold mb-6">
                  Enjoying the story?
                </p>
                <a
                  href={donationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-full text-amber-300 text-sm font-medium transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 01-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 013.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 01-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 01-4.743.295 37.059 37.059 0 01-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0011.343.376.483.483 0 01.535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 01.39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 01-.169.364zm-6.159 3.9c-.862.37-1.84.788-3.109.788a5.884 5.884 0 01-1.569-.217l.877 9.004c.065.78.717 1.38 1.5 1.38 0 0 1.243.065 1.658.065.447 0 1.786-.065 1.786-.065.783 0 1.434-.6 1.499-1.38l.94-9.95a3.996 3.996 0 00-1.322-.238c-.826 0-1.491.284-2.26.613z" />
                  </svg>
                  Support this project
                </a>
                <p className="text-white/30 text-xs mt-4">
                  Tap to continue
                </p>
              </div>
            )}
          </div>

          {/* Tap zones */}
          <button
            onClick={goToPrev}
            className="absolute left-0 top-0 w-1/3 h-full z-20 focus:outline-none"
            aria-label="Previous"
          />
          <button
            onClick={goToNext}
            className="absolute right-0 top-0 w-1/3 h-full z-20 focus:outline-none"
            aria-label="Next"
          />
        </>
      ) : (
        /* Scroll mode */
        <div
          ref={scrollContainerRef}
          className="absolute inset-0 pt-16 overflow-y-auto z-10"
        >
          <div className="flex flex-col items-center gap-2 pb-8 px-2">
            {slides.map((slide, idx) => (
              <div
                key={idx}
                ref={(el) => { pageRefs.current[idx] = el; }}
                className="w-full max-w-2xl"
              >
                {slide.type === "page" ? (
                  <img
                    src={slide.page.src}
                    alt={`Chapter ${slide.page.chapterNum} - Page ${slide.page.pageNum}`}
                    className="w-full h-auto object-contain"
                    style={{
                      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4)",
                    }}
                  />
                ) : (
                  <div
                    className="rounded-2xl px-8 py-10 backdrop-blur-xl text-center mx-auto max-w-sm"
                    style={{
                      background: "rgba(0, 0, 0, 0.5)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    <p className="text-white/60 text-sm mb-2">
                      End of Chapter {slide.chapterNum}
                    </p>
                    <p className="text-white text-lg font-semibold mb-6">
                      Enjoying the story?
                    </p>
                    <a
                      href={donationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-full text-amber-300 text-sm font-medium transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 01-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 013.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 01-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 01-4.743.295 37.059 37.059 0 01-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0011.343.376.483.483 0 01.535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 01.39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 01-.169.364zm-6.159 3.9c-.862.37-1.84.788-3.109.788a5.884 5.884 0 01-1.569-.217l.877 9.004c.065.78.717 1.38 1.5 1.38 0 0 1.243.065 1.658.065.447 0 1.786-.065 1.786-.065.783 0 1.434-.6 1.499-1.38l.94-9.95a3.996 3.996 0 00-1.322-.238c-.826 0-1.491.284-2.26.613z" />
                      </svg>
                      Support this project
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

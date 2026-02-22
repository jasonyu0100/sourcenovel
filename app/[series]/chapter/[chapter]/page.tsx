"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import type { SeriesEntry } from "@/lib/types";
import {
  getSeriesEntry,
  getChapterDraft,
  getMusicPath,
  extractTitleFromMarkdown,
  stripTitleFromMarkdown,
  calculateReadingTime,
} from "@/lib/series";
import {
  ReaderSettingsProvider,
  useReaderSettings,
  themeColors,
  widthValues,
  fontFamilies,
} from "@/lib/reader-settings";
import { AudioPlayer } from "@/components/audio-player";
import { ReaderSettingsPanel } from "@/components/reader-settings-panel";
import { MarkdownContent } from "@/components/markdown-content";
import { API_BASE } from "@/lib/constants";

function ChapterContent() {
  const params = useParams();
  const seriesId = params.series as string;
  const chapterNum = parseInt(params.chapter as string);

  const { settings } = useReaderSettings();
  const [entry, setEntry] = useState<SeriesEntry | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [musicError, setMusicError] = useState(false);
  const [musicChecked, setMusicChecked] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readingTime, setReadingTime] = useState(0);

  const handleMusicError = useCallback(() => {
    setMusicError(true);
  }, []);

  // Check if music file exists
  useEffect(() => {
    if (!seriesId) return;
    const musicPath = getMusicPath(seriesId, chapterNum);
    fetch(musicPath, { method: "HEAD" })
      .then((res) => {
        if (!res.ok) setMusicError(true);
        setMusicChecked(true);
      })
      .catch(() => {
        setMusicError(true);
        setMusicChecked(true);
      });
  }, [seriesId, chapterNum]);

  // Track reading progress
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight - windowHeight;
      if (documentHeight <= 0) return;
      const scrollTop = Math.max(0, window.scrollY);
      const progress = Math.min((scrollTop / documentHeight) * 100, 100);
      setReadingProgress(progress);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!seriesId) return;
    Promise.all([
      getSeriesEntry(seriesId),
      getChapterDraft(seriesId, chapterNum),
    ])
      .then(([entryData, draft]) => {
        setEntry(entryData);
        setContent(draft);
        const { readingTime: time } = calculateReadingTime(draft);
        setReadingTime(time);
      })
      .finally(() => setLoading(false));
  }, [seriesId, chapterNum]);

  // Get current theme colors
  const colors = themeColors[settings.theme];
  const contentWidth = widthValues[settings.width];
  const fontFamily = fontFamilies[settings.font];

  // Container styles
  const containerStyle = {
    backgroundColor: colors.background,
    backgroundImage: `url(${API_BASE}/${seriesId}/background.jpg)`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
    color: colors.text,
    minHeight: "100vh",
    paddingBottom: musicChecked && musicError ? "3rem" : "9rem",
    transition: "background-color 0.3s ease, color 0.3s ease",
  };

  // Header styles
  const headerStyle = {
    backgroundColor: colors.headerBg,
    borderColor: colors.border,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  };

  // Content width style
  const contentWidthStyle = {
    maxWidth: contentWidth,
    marginLeft: "auto",
    marginRight: "auto",
  };

  // Prose style - include text color for proper contrast in all themes
  const proseStyle = {
    fontFamily: fontFamily,
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    color: colors.text,
  };

  if (loading) {
    return (
      <div style={containerStyle} className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <p style={{ color: colors.textMuted }}>Loading chapter...</p>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div style={containerStyle} className="flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <h1 className="text-2xl mb-4" style={{ color: colors.textMuted }}>Chapter not found</h1>
          <Link href={`/${seriesId}`} style={{ color: colors.accent }} className="hover:opacity-80 transition-colors">
            Back to series
          </Link>
        </div>
      </div>
    );
  }

  const chapterTitle = extractTitleFromMarkdown(content);
  const strippedContent = stripTitleFromMarkdown(content);
  const musicPath = getMusicPath(seriesId, chapterNum);
  const chapters = entry.chapters || [];
  const currentIndex = chapters.indexOf(chapterNum);
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter =
    currentIndex < chapters.length - 1
      ? chapters[currentIndex + 1]
      : null;

  return (
    <div style={containerStyle} className="relative">
      {/* Dark overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ backgroundColor: `${colors.background}cc` }}
      />

      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5 z-50" style={{ backgroundColor: `${colors.text}10` }}>
        <div
          className="h-full reading-progress transition-all duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b" style={headerStyle}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link
            href={`/${seriesId}`}
            className="inline-flex items-center gap-2 text-sm group transition-colors"
            style={{ color: colors.textMuted }}
          >
            <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">{entry.title}</span>
            <span className="sm:hidden">Back</span>
          </Link>

          <div className="flex items-center gap-2">
            {prevChapter && (
              <Link
                href={`/${seriesId}/chapter/${prevChapter}`}
                className="p-2 rounded-lg transition-all hover:opacity-70"
                style={{ color: colors.textMuted }}
                title={`Chapter ${prevChapter}`}
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </Link>
            )}
            <span className="text-sm font-medium" style={{ color: colors.textMuted }}>
              Ch. {chapterNum}
            </span>
            {nextChapter && (
              <Link
                href={`/${seriesId}/chapter/${nextChapter}`}
                className="p-2 rounded-lg transition-all hover:opacity-70"
                style={{ color: colors.textMuted }}
                title={`Chapter ${nextChapter}`}
              >
                <ChevronRightIcon className="w-5 h-5" />
              </Link>
            )}

            {/* Settings button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg transition-all hover:opacity-70 ml-2"
              style={{ color: colors.textMuted }}
              title="Reader settings"
            >
              <Cog6ToothIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Chapter content */}
      <main className="relative z-10 px-4 sm:px-6 py-10 sm:py-16 animate-fade-in" style={contentWidthStyle}>
        <article>
          {/* Chapter header */}
          <header className="text-center mb-10 sm:mb-16">
            <p className="text-sm font-medium tracking-widest uppercase mb-3" style={{ color: colors.accent }}>
              Chapter {chapterNum}
            </p>
            {chapterTitle && chapterTitle !== `Chapter ${chapterNum}` ? (
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: colors.textPrimary }}>
                {chapterTitle}
              </h1>
            ) : (
              <div className="w-12 h-px mx-auto" style={{ background: `linear-gradient(to right, transparent, ${colors.accent}50, transparent)` }} />
            )}
            {readingTime > 0 && (
              <p className="text-sm mt-4" style={{ color: colors.textMuted }}>
                {readingTime} min read
              </p>
            )}
          </header>

          {/* Prose content */}
          <div className="prose-chapter" style={proseStyle}>
            <MarkdownContent content={strippedContent} />
          </div>
        </article>

        {/* End of chapter marker */}
        <div className="mt-20 mb-12 flex items-center justify-center gap-4">
          <div className="h-px w-16" style={{ background: `linear-gradient(to right, transparent, ${colors.textMuted}40)` }} />
          <span className="text-sm" style={{ color: colors.textMuted }}>End of Chapter {chapterNum}</span>
          <div className="h-px w-16" style={{ background: `linear-gradient(to left, transparent, ${colors.textMuted}40)` }} />
        </div>

        {/* Chapter navigation */}
        <nav className="flex items-center justify-between py-8 border-y" style={{ borderColor: `${colors.text}10` }}>
          {prevChapter ? (
            <Link
              href={`/${seriesId}/chapter/${prevChapter}`}
              className="group flex items-center gap-3 transition-colors"
              style={{ color: colors.textMuted }}
            >
              <div
                className="w-10 h-10 rounded-full border flex items-center justify-center transition-all group-hover:opacity-80"
                style={{ borderColor: `${colors.text}20`, backgroundColor: `${colors.text}05` }}
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs mb-0.5" style={{ color: colors.textMuted }}>Previous</p>
                <p className="font-medium">Chapter {prevChapter}</p>
              </div>
            </Link>
          ) : (
            <div />
          )}

          <Link
            href={`/${seriesId}`}
            className="hidden sm:block text-sm transition-colors hover:opacity-70"
            style={{ color: colors.textMuted }}
          >
            All Chapters
          </Link>

          {nextChapter ? (
            <Link
              href={`/${seriesId}/chapter/${nextChapter}`}
              className="group flex items-center gap-3 transition-colors"
              style={{ color: colors.textMuted }}
            >
              <div className="text-right">
                <p className="text-xs mb-0.5" style={{ color: colors.textMuted }}>Next</p>
                <p className="font-medium">Chapter {nextChapter}</p>
              </div>
              <div
                className="w-10 h-10 rounded-full border flex items-center justify-center transition-all group-hover:opacity-80"
                style={{ borderColor: `${colors.text}20`, backgroundColor: `${colors.text}05` }}
              >
                <ChevronRightIcon className="w-5 h-5" />
              </div>
            </Link>
          ) : (
            <div />
          )}
        </nav>

        {/* Support link */}
        {entry.donationLink && (
          <div className="mt-16 text-center">
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
          </div>
        )}
      </main>

      {/* Sticky audio player */}
      {musicChecked && !musicError && (
        <div
          className="fixed bottom-0 left-0 right-0 z-10 p-3 sm:p-4 safe-area-bottom"
          style={{ backgroundColor: colors.background }}
        >
          <div style={contentWidthStyle}>
            <AudioPlayer
              src={musicPath}
              autoPlay={false}
              onError={handleMusicError}
              themeColors={colors}
            />
          </div>
        </div>
      )}

      {/* Settings panel */}
      <ReaderSettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function ChapterPage() {
  return (
    <ReaderSettingsProvider>
      <ChapterContent />
    </ReaderSettingsProvider>
  );
}

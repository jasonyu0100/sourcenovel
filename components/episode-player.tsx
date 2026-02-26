"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, MusicalNoteIcon, SpeakerWaveIcon, SpeakerXMarkIcon, ArrowLeftIcon, BoltIcon } from "@heroicons/react/24/outline";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { EpisodeChapterData, EpisodeData } from "@/lib/episode-types";
import { buildStoryContext } from "@/lib/episode-context";
import { loadEpisodeData, loadInteractiveModule, loadChapterRoute, loadChapterMemory, loadSeriesContext, loadArcContext, loadCharacterProfiles } from "@/lib/episode-data";
import { EpisodeDialogueBox } from "./episode-dialogue-box";
import { EpisodeInteractive } from "./episode-interactive";
import { API_BASE } from "@/lib/constants";


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


interface EpisodePlayerProps {
  chapterData: EpisodeChapterData;
  seriesId: string;
  onClose: () => void;
  replaySessionId?: string | null;
  initialBeatIndex?: number;
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function EpisodePlayer({ chapterData, seriesId, onClose, replaySessionId, initialBeatIndex }: EpisodePlayerProps) {
  const { isSignedIn } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialBeatIndex && initialBeatIndex > 0 ? initialBeatIndex : 0);
  const [mounted, setMounted] = useState(false);
  const [textComplete, setTextComplete] = useState(false);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(!!replaySessionId);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [episodeData, setEpisodeData] = useState<EpisodeData | null>(null);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [playAsCharacter, setPlayAsCharacter] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<"illustrated" | "dialogue">("dialogue");
  const [showModePicker, setShowModePicker] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [activeReplayId, setActiveReplayId] = useState<string | null>(replaySessionId ?? null);
  const [expandedBubble, setExpandedBubble] = useState<string | null>(null);
  const [interactiveModule, setInteractiveModule] = useState<string | null>(null);
  const [chapterRoute, setChapterRoute] = useState<string | null>(null);
  const [chapterMemory, setChapterMemory] = useState<string | null>(null);
  const [seriesContext, setSeriesContext] = useState<string | null>(null);
  const [arcContext, setArcContext] = useState<string | null>(null);
  const [characterProfiles, setCharacterProfiles] = useState<Record<string, string> | null>(null);

  // Track current and previous backdrop for crossfade
  const [displayImage, setDisplayImage] = useState<string | null>(null);
  const [prevImage, setPrevImage] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);

  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const ttsRef = useRef<HTMLAudioElement | null>(null);
  const isNavigating = useRef(false);
  const playRecordedRef = useRef(false);

  // Alternate reality interactions for this chapter
  const chapterInteractions = useQuery(
    api.interactions.getChapterInteractions,
    { seriesId, chapterNum: chapterData.chapterNum }
  );

  const recordPlay = useMutation(api.interactions.recordEpisodePlay);

  const { beats } = chapterData;
  const currentBeat = beats[currentIndex];

  useEffect(() => {
    setMounted(true);
    if (!playRecordedRef.current) {
      playRecordedRef.current = true;
      recordPlay({ seriesId, chapterNum: chapterData.chapterNum });
    }
    loadEpisodeData(seriesId, chapterData.chapterNum).then(setEpisodeData);
    loadInteractiveModule(seriesId).then(setInteractiveModule);
    loadChapterRoute(seriesId, chapterData.chapterNum).then(setChapterRoute);
    loadChapterMemory(seriesId, chapterData.chapterNum).then(setChapterMemory);
    loadSeriesContext(seriesId).then(setSeriesContext);
  }, [seriesId, chapterData.chapterNum]);

  // Load arc context based on episodeData.arcNum (or default to 1)
  useEffect(() => {
    const arcNum = episodeData?.arcNum ?? 1;
    loadArcContext(seriesId, arcNum).then(setArcContext);
  }, [seriesId, episodeData?.arcNum]);

  // Load character profiles once we have the slug list from episodeData
  useEffect(() => {
    if (!episodeData?.characters?.length) return;
    const slugs = episodeData.characters.map(c => c.slug);
    loadCharacterProfiles(seriesId, slugs).then(setCharacterProfiles);
  }, [seriesId, episodeData]);

  // Update URL with current beat position (for auth redirect preservation)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (currentIndex > 0) {
      url.searchParams.set("beat", String(currentIndex));
    } else {
      url.searchParams.delete("beat");
    }
    window.history.replaceState({}, "", url.toString());
  }, [currentIndex]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Init BGM audio element
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.3;
    bgmRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      bgmRef.current = null;
    };
  }, []);

  // Init TTS audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.9;
    ttsRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      ttsRef.current = null;
    };
  }, []);

  // Update display image when beat changes
  useEffect(() => {
    if (!currentBeat) return;
    const newImage = currentBeat.panelImageSrc;
    if (newImage !== displayImage) {
      setPrevImage(displayImage);
      setDisplayImage(newImage);
      setImageReady(false);
    }
  }, [currentIndex]);

  // Preload current + adjacent images
  useEffect(() => {
    if (beats.length === 0) return;
    const preload = (idx: number) => {
      if (idx >= 0 && idx < beats.length) {
        const img = new Image();
        img.src = beats[idx].panelImageSrc;
      }
    };
    preload(currentIndex);
    preload(currentIndex + 1);
    preload(currentIndex - 1);
  }, [currentIndex, beats]);

  // Play SFX when beat changes
  const sfxElementsRef = useRef<HTMLAudioElement[]>([]);
  useEffect(() => {
    // Stop any previous SFX
    sfxElementsRef.current.forEach(a => { a.pause(); a.src = ""; });
    sfxElementsRef.current = [];

    if (!currentBeat || currentBeat.sfxSrcs.length === 0) return;

    for (const src of currentBeat.sfxSrcs) {
      const audio = new Audio(src);
      audio.volume = 0.7;
      audio.play().catch(() => {});
      sfxElementsRef.current.push(audio);
    }

    return () => {
      sfxElementsRef.current.forEach(a => { a.pause(); a.src = ""; });
      sfxElementsRef.current = [];
    };
  }, [currentIndex]);

  // Play TTS when beat changes
  useEffect(() => {
    if (!currentBeat || !ttsEnabled) return;
    const tts = ttsRef.current;
    if (!tts) return;

    if (currentBeat.dialogue?.ttsSrc) {
      tts.src = currentBeat.dialogue.ttsSrc;
      tts.currentTime = 0;
      tts.play().catch(() => {});
    } else {
      tts.pause();
    }
  }, [currentIndex, ttsEnabled]);

  const goToNext = useCallback(() => {
    if (isNavigating.current) return;
    if (currentIndex >= beats.length - 1) {
      setShowEndScreen(true);
      return;
    }
    isNavigating.current = true;
    setCurrentIndex(prev => prev + 1);
    setTextComplete(false);
    setTimeout(() => { isNavigating.current = false; }, 200);
  }, [currentIndex, beats.length]);

  const goToPrev = useCallback(() => {
    if (isNavigating.current) return;
    if (currentIndex <= 0) return;
    isNavigating.current = true;
    setCurrentIndex(prev => prev - 1);
    setTextComplete(false);
    setTimeout(() => { isNavigating.current = false; }, 200);
  }, [currentIndex]);

  // Keyboard navigation — disabled during interactive mode
  useEffect(() => {
    if (interactiveMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!currentBeat?.dialogue) {
          goToNext();
        }
      } else if (e.key === "ArrowLeft") {
        goToPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goToNext, goToPrev, currentBeat, interactiveMode]);

  // Auto-start BGM — try immediately, fall back to gesture if browser blocks
  const bgmStartedRef = useRef(false);
  useEffect(() => {
    if (bgmStartedRef.current || !bgmEnabled || !chapterData.musicSrc) return;
    const audio = bgmRef.current;
    if (!audio) return;

    const startBgm = () => {
      if (bgmStartedRef.current) return;
      bgmStartedRef.current = true;
      audio.src = chapterData.musicSrc!;
      audio.volume = 0.3;
      audio.play()
        .then(() => setBgmPlaying(true))
        .catch(() => { bgmStartedRef.current = false; });
    };

    // Try autoplay immediately (works if user already interacted with the page)
    audio.src = chapterData.musicSrc!;
    audio.volume = 0.3;
    audio.play()
      .then(() => {
        bgmStartedRef.current = true;
        setBgmPlaying(true);
      })
      .catch(() => {
        // Autoplay blocked — wait for first user gesture
        window.addEventListener("click", startBgm, { once: true });
        window.addEventListener("keydown", startBgm, { once: true });
      });

    return () => {
      window.removeEventListener("click", startBgm);
      window.removeEventListener("keydown", startBgm);
    };
  }, [bgmEnabled, chapterData.musicSrc]);

  const toggleBgm = useCallback(() => {
    const audio = bgmRef.current;
    if (!audio) return;

    if (bgmPlaying) {
      fadeOutAudio(audio, () => {
        audio.pause();
        setBgmPlaying(false);
        setBgmEnabled(false);
      });
    } else {
      setBgmEnabled(true);
      if (chapterData.musicSrc) {
        audio.src = chapterData.musicSrc;
        audio.currentTime = 0;
        audio.volume = 0.3;
        audio.play()
          .then(() => setBgmPlaying(true))
          .catch(() => {});
      }
    }
  }, [bgmPlaying, chapterData.musicSrc]);

  const toggleTts = useCallback(() => {
    const tts = ttsRef.current;
    if (ttsEnabled && tts) {
      tts.pause();
    }
    setTtsEnabled(prev => !prev);
  }, [ttsEnabled]);

  const handleTakeControl = useCallback(() => {
    if (!isSignedIn) {
      setShowSignInPrompt(true);
      return;
    }
    setActiveReplayId(null);
    // Always show mode picker first
    setShowModePicker(true);
  }, [isSignedIn]);

  const handleSelectMode = useCallback((mode: "illustrated" | "dialogue") => {
    setSessionMode(mode);
    setShowModePicker(false);
    if (episodeData && episodeData.characters.length > 1) {
      setShowCharacterPicker(true);
    } else {
      // Only one character or no episodeData — go straight to interactive
      setPlayAsCharacter(episodeData?.defaultCharacter || null);
      setShowEndScreen(false);
      setInteractiveMode(true);
    }
  }, [episodeData]);

  const handleSelectCharacter = useCallback((characterName: string) => {
    setPlayAsCharacter(characterName);
    setShowCharacterPicker(false);
    setShowEndScreen(false);
    setInteractiveMode(true);
  }, []);

  // Auto-return to episodes after end screen timeout
  const [endCountdown, setEndCountdown] = useState(10);
  useEffect(() => {
    if (!showEndScreen || interactiveMode) return;
    setEndCountdown(10);
    const timer = setInterval(() => {
      setEndCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showEndScreen, interactiveMode, onClose]);

  if (!mounted || beats.length === 0) return null;

  const progress = ((currentIndex + 1) / beats.length) * 100;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Blurred background fill */}
      <div className="absolute inset-0 overflow-hidden">
        {prevImage && (
          <img
            src={prevImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-3xl scale-125 opacity-50 transition-opacity duration-500"
            style={{ opacity: imageReady ? 0 : 1 }}
          />
        )}
        {displayImage && (
          <img
            src={displayImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-3xl scale-125 opacity-50 transition-opacity duration-500"
            style={{ opacity: imageReady ? 1 : 0 }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
      </div>

      {/* Main panel image — fully visible, contained */}
      <div className="absolute inset-0 flex items-center justify-center pt-14 pb-24">
        {prevImage && (
          <img
            src={prevImage}
            alt=""
            className="max-w-full max-h-full object-contain transition-opacity duration-500"
            style={{ opacity: imageReady ? 0 : 1, position: "absolute" }}
          />
        )}
        {displayImage && (
          <img
            src={displayImage}
            alt=""
            className="max-w-full max-h-full object-contain transition-opacity duration-500"
            style={{ opacity: imageReady ? 1 : 0 }}
            onLoad={() => setImageReady(true)}
          />
        )}
      </div>

      {/* Dark gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

      {/* Controls header — always visible */}
      <div className="absolute top-0 left-0 right-0 z-40 px-4 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-black/60 hover:text-white transition-all"
            aria-label="Back"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <p className="text-white text-sm font-medium">
              Episode {chapterData.chapterNum}: {chapterData.title}
            </p>
            <p className="text-white/50 text-xs">
              {currentIndex + 1} / {beats.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); toggleBgm(); }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              bgmPlaying
                ? "bg-violet-500/30 text-violet-300 ring-2 ring-violet-500/40"
                : "bg-black/40 backdrop-blur-md text-white/70 hover:bg-black/60 hover:text-white"
            }`}
            aria-label={bgmPlaying ? "Pause music" : "Play music"}
          >
            <MusicalNoteIcon className={`w-4 h-4 ${bgmPlaying ? "animate-music-pulse" : ""}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleTts(); }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              ttsEnabled
                ? "bg-sky-500/30 text-sky-300 ring-2 ring-sky-500/40"
                : "bg-black/40 backdrop-blur-md text-white/70 hover:bg-black/60 hover:text-white"
            }`}
            aria-label={ttsEnabled ? "Mute voice" : "Unmute voice"}
          >
            {ttsEnabled ? <SpeakerWaveIcon className="w-4 h-4" /> : <SpeakerXMarkIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/90 hover:bg-black/60 transition-all"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 z-40 h-1 bg-white/10">
        <div
          className="h-full bg-violet-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Tap zones — always active; dialogue box (z-30) overlaps bottom portion */}
      <button
        onClick={() => { setExpandedBubble(null); goToPrev(); }}
        className="absolute left-0 top-0 w-1/3 h-full z-20 focus:outline-none"
        aria-label="Previous"
      />
      <button
        onClick={() => { setExpandedBubble(null); goToNext(); }}
        className="absolute right-0 top-0 w-2/3 h-full z-20 focus:outline-none"
        aria-label="Next"
      />

      {/* Alternate timelines — right edge */}
      {!interactiveMode && (() => {
        const allSessions = chapterInteractions?.filter((s: { beatCount: number }) => s.beatCount > 0) ?? [];
        if (allSessions.length === 0) return null;

        const sorted = [...allSessions].sort((a, b) => {
          const aHl = a.startBeatIndex === currentIndex ? 1 : 0;
          const bHl = b.startBeatIndex === currentIndex ? 1 : 0;
          if (aHl !== bHl) return bHl - aHl;
          return b.beatCount - a.beatCount;
        });

        return (
          <div className="absolute right-3 z-[25] pointer-events-none flex flex-col items-end gap-4" style={{ top: "50%", transform: "translateY(-50%)" }}>
            {sorted.slice(0, 5).map((session) => {
              const isExpanded = expandedBubble === session._id;
              const isIllustrated = session.mode === "illustrated";
              const charSlug = session.characterName.toLowerCase().replace(/\s+/g, "-");
              const charImg = `${API_BASE}/${seriesId}/world/characters/${charSlug}.jpg`;

              return (
                <div key={session._id} className="pointer-events-auto relative">
                  {/* Popover — floating left, vertically centered on bubble */}
                  {isExpanded && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveReplayId(session._id);
                        setPlayAsCharacter(null);
                        setInteractiveMode(true);
                        setExpandedBubble(null);
                      }}
                      className="absolute right-full mr-2 top-1/2 -translate-y-1/2 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-black/80 backdrop-blur-md whitespace-nowrap hover:bg-black/90 transition-all"
                      style={{ animation: "fadeIn 0.15s ease-out" }}
                    >
                      {session.userImage ? (
                        <img src={session.userImage} alt={session.userName} className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                          <span className="text-[10px] text-white font-semibold">{session.userName[0]}</span>
                        </div>
                      )}
                      <div className="min-w-0 text-left">
                        <p className="text-white text-[11px] font-medium leading-tight">{session.userName}</p>
                        <p className="text-white/40 text-[10px] leading-tight">
                          {session.beatCount} {session.beatCount === 1 ? "beat" : "beats"} · {isIllustrated ? "Illustrated" : "Dialogue"} · {timeAgo(session.startedAt)}
                        </p>
                      </div>
                      <span className="text-white/50 text-[10px] ml-1">Watch</span>
                    </button>
                  )}
                  {/* Avatar bubble — character photo */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedBubble(isExpanded ? null : session._id);
                    }}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className={`w-11 h-11 rounded-full overflow-hidden transition-all duration-200 ${
                      isExpanded
                        ? "ring-2 ring-white scale-110"
                        : "ring-1 ring-white/20 opacity-70 group-hover:opacity-100 group-hover:ring-white/40"
                    }`}>
                      <img src={charImg} alt={session.characterName} className="w-full h-full object-cover object-top" />
                    </div>
                    <span className={`text-[10px] leading-none ${
                      isExpanded ? "text-white font-medium" : "text-white/40"
                    }`}>
                      {session.characterName.split(" ")[0]}
                    </span>
                  </button>
                </div>
              );
            })}
            {sorted.length > 5 && (
              <span className="text-white/30 text-[10px] font-medium">+{sorted.length - 5}</span>
            )}
          </div>
        );
      })()}

      {/* Dialogue box */}
      <EpisodeDialogueBox
        speaker={currentBeat?.dialogue?.speaker || null}
        text={currentBeat?.dialogue?.text || null}
        beatIndex={currentIndex}
        isVisible={!!currentBeat?.dialogue}
        onTextComplete={() => setTextComplete(true)}
        onAdvance={goToNext}
        onTakeControl={handleTakeControl}
        seriesId={seriesId}
        episodeData={episodeData}
      />

      {/* Silent beat bottom bar — tap to continue */}
      {!currentBeat?.dialogue && (
        <div className="absolute bottom-6 left-0 right-0 z-30 flex items-center justify-center">
          <span className="text-white/30 text-sm animate-pulse pointer-events-none">Tap to continue</span>
        </div>
      )}

      {/* Floating Interact button — above dialogue */}
      {!interactiveMode && !showEndScreen && (textComplete || !currentBeat?.dialogue) && (
        <div
          className="absolute left-0 right-0 z-[35] flex justify-center pointer-events-none"
          style={{ bottom: currentBeat?.dialogue ? "12rem" : "4rem" }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); handleTakeControl(); }}
            className="pointer-events-auto inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-violet-600/40 hover:bg-violet-600/50 border border-violet-400/50 text-violet-200 hover:text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] transition-all text-sm font-semibold backdrop-blur-md"
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5" />
            Interact
          </button>
        </div>
      )}

      {/* End of chapter screen */}
      {showEndScreen && !interactiveMode && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="max-w-sm w-full mx-4 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/10 p-8 text-center shadow-2xl">
            <p className="text-white/50 text-sm mb-1">End of</p>
            <p className="text-white text-xl font-semibold mb-6">
              Episode {chapterData.chapterNum}: {chapterData.title}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { setShowEndScreen(false); handleTakeControl(); }}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 rounded-xl text-violet-300 text-sm font-medium transition-all"
              >
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                Interact
              </button>
              <button
                onClick={onClose}
                className="w-full px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white text-sm transition-all"
              >
                Back to episodes ({endCountdown}s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Character select overlay */}
      {showCharacterPicker && episodeData && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          {/* Title */}
          <div className="text-center mb-8">
            <p className="text-violet-400 text-xs uppercase tracking-[0.25em] font-semibold mb-2">Choose Your Character</p>
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent mx-auto" />
          </div>

          {/* Character grid */}
          <div className={`grid gap-4 px-6 max-w-3xl w-full ${
            episodeData.characters.length <= 2 ? "grid-cols-2 max-w-md" :
            episodeData.characters.length === 3 ? "grid-cols-3 max-w-xl" :
            "grid-cols-2 sm:grid-cols-4"
          }`}>
            {episodeData.characters.map(char => (
              <CharacterPickerOption
                key={char.slug}
                name={char.name}
                imageSrc={`${API_BASE}/${seriesId}/world/characters/${char.slug}.jpg`}
                isDefault={char.name === episodeData.defaultCharacter}
                onSelect={() => handleSelectCharacter(char.name)}
              />
            ))}
          </div>

          {/* Cancel */}
          <button
            onClick={() => setShowCharacterPicker(false)}
            className="mt-8 px-6 py-2 text-slate-500 hover:text-slate-300 text-sm transition-all"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Sign-in prompt overlay */}
      {showSignInPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="max-w-sm w-full mx-4 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/10 p-8 text-center shadow-2xl">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4">
              <ChatBubbleLeftRightIcon className="w-6 h-6 text-violet-400" />
            </div>
            <p className="text-white text-lg font-semibold mb-2">Sign in to interact</p>
            <p className="text-white/40 text-sm mb-6">Create a free account to play interactive episodes and make choices that shape the story.</p>
            <div className="space-y-3">
              <a
                href={`/sign-in?redirect_url=${encodeURIComponent(`/${seriesId}/episode/${chapterData.chapterNum}?beat=${currentIndex}`)}`}
                className="block w-full px-5 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-white text-sm font-medium transition-all text-center"
              >
                Sign in
              </a>
              <button
                onClick={() => setShowSignInPrompt(false)}
                className="w-full px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode picker overlay */}
      {showModePicker && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="text-center mb-8">
            <p className="text-violet-400 text-xs uppercase tracking-[0.25em] font-semibold mb-2">Choose Mode</p>
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent mx-auto" />
          </div>

          <div className="grid grid-cols-2 gap-4 px-6 max-w-md w-full">
            {/* Dialogue — default / recommended */}
            <button
              onClick={() => handleSelectMode("dialogue")}
              className="group relative flex flex-col items-center rounded-xl border-2 overflow-hidden transition-all duration-200 hover:scale-105 border-violet-500/60 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]"
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-gradient-to-b from-violet-900/60 via-violet-950/80 to-black flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="w-14 h-14 text-violet-400/80 transition-transform duration-300 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-violet-500/80 backdrop-blur-sm rounded text-[9px] uppercase tracking-wider text-white font-bold">
                  Recommended
                </div>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/30 backdrop-blur-sm">
                    <BoltIcon className="w-3 h-3 text-violet-300" />
                    <span className="text-violet-200 text-[11px] font-semibold">1 token / interaction</span>
                  </div>
                </div>
              </div>
              <div className="w-full px-3 py-3 text-center bg-violet-950/60">
                <p className="text-white font-semibold text-sm tracking-wide">Dialogue</p>
                <p className="text-white/40 text-[10px] mt-0.5">Story and choices</p>
                <p className="text-violet-400/40 text-[9px] mt-0.5">Faster — text only</p>
              </div>
            </button>

            {/* Illustrated */}
            <button
              onClick={() => handleSelectMode("illustrated")}
              className="group relative flex flex-col items-center rounded-xl border-2 overflow-hidden transition-all duration-200 hover:scale-105 border-white/10 hover:border-white/30 shadow-lg"
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-gradient-to-b from-slate-800/60 via-slate-900/80 to-black flex items-center justify-center">
                <svg className="w-14 h-14 text-slate-500/80 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 backdrop-blur-sm">
                    <BoltIcon className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-300 text-[11px] font-semibold">6 tokens / interaction</span>
                  </div>
                </div>
              </div>
              <div className="w-full px-3 py-3 text-center bg-black/60">
                <p className="text-white font-semibold text-sm tracking-wide">Illustrated</p>
                <p className="text-white/40 text-[10px] mt-0.5">Manga panels + story</p>
                <p className="text-amber-400/40 text-[9px] mt-0.5">Slower — images each beat</p>
              </div>
            </button>
          </div>

          <button
            onClick={() => setShowModePicker(false)}
            className="mt-8 px-6 py-2 text-slate-500 hover:text-slate-300 text-sm transition-all"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Interactive mode overlay */}
      {interactiveMode && (
        <EpisodeInteractive
          storyContext={buildStoryContext(seriesId, chapterData, currentIndex, episodeData, chapterRoute, chapterMemory, seriesContext, arcContext, characterProfiles)}
          playAsCharacter={playAsCharacter}
          sessionMode={sessionMode}
          interactiveModule={interactiveModule}
          bgmPlaying={bgmPlaying}
          onToggleBgm={toggleBgm}
          onClose={() => { setInteractiveMode(false); setActiveReplayId(null); }}
          onBackToEpisodes={onClose}
          replaySessionId={activeReplayId}
        />
      )}
    </div>,
    document.body
  );
}

function CharacterPickerOption({ name, imageSrc, isDefault, onSelect }: {
  name: string;
  imageSrc: string;
  isDefault: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group relative flex flex-col items-center rounded-xl border-2 overflow-hidden transition-all duration-200 hover:scale-105 ${
        isDefault
          ? "border-violet-500/60 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]"
          : "border-white/10 hover:border-white/30 shadow-lg"
      }`}
    >
      {/* Portrait */}
      <div className="relative w-full aspect-[2/3] overflow-hidden">
        <img
          src={imageSrc}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        {/* Recommended badge */}
        {isDefault && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-violet-500/80 backdrop-blur-sm rounded text-[9px] uppercase tracking-wider text-white font-bold">
            Recommended
          </div>
        )}
      </div>

      {/* Name plate */}
      <div className={`w-full px-3 py-3 text-center ${
        isDefault ? "bg-violet-950/60" : "bg-black/60"
      }`}>
        <p className="text-white font-semibold text-sm tracking-wide">{name}</p>
      </div>
    </button>
  );
}

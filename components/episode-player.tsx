"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, MusicalNoteIcon, SpeakerWaveIcon, SpeakerXMarkIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/solid";
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
}

export function EpisodePlayer({ chapterData, seriesId, onClose }: EpisodePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [textComplete, setTextComplete] = useState(false);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [episodeData, setEpisodeData] = useState<EpisodeData | null>(null);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [playAsCharacter, setPlayAsCharacter] = useState<string | null>(null);
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

  const { beats } = chapterData;
  const currentBeat = beats[currentIndex];

  useEffect(() => {
    setMounted(true);
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
    if (episodeData && episodeData.characters.length > 1) {
      setShowCharacterPicker(true);
    } else {
      // Only one character or no episodeData — go straight to interactive
      setPlayAsCharacter(episodeData?.defaultCharacter || null);
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
        onClick={goToPrev}
        className="absolute left-0 top-0 w-1/3 h-full z-20 focus:outline-none"
        aria-label="Previous"
      />
      <button
        onClick={goToNext}
        className="absolute right-0 top-0 w-2/3 h-full z-20 focus:outline-none"
        aria-label="Next"
      />

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

      {/* Silent beat bottom bar — tap to continue + take control */}
      {!currentBeat?.dialogue && (
        <div className="absolute bottom-6 left-0 right-0 z-30 flex items-center justify-center gap-4">
          <span className="text-white/30 text-sm animate-pulse pointer-events-none">Tap to continue</span>
          <button
            onClick={(e) => { e.stopPropagation(); handleTakeControl(); }}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-violet-600/30 hover:bg-violet-600/40 border border-violet-500/50 text-violet-300 shadow-[0_0_14px_rgba(139,92,246,0.35)] hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] transition-all text-sm font-medium"
            title="Start chat"
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4" />
            Start chat
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
                Start chat
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

      {/* Interactive mode overlay */}
      {interactiveMode && (
        <EpisodeInteractive
          storyContext={buildStoryContext(seriesId, chapterData, currentIndex, episodeData, chapterRoute, chapterMemory, seriesContext, arcContext, characterProfiles)}
          playAsCharacter={playAsCharacter}
          interactiveModule={interactiveModule}
          bgmPlaying={bgmPlaying}
          onToggleBgm={toggleBgm}
          onClose={() => setInteractiveMode(false)}
          onBackToEpisodes={onClose}
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

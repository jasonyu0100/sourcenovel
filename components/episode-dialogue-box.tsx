"use client";

import { useState, useEffect, useRef } from "react";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/solid";
import { characterToImageSrc } from "@/lib/episode-context";
import { CharacterPreviewTooltip } from "./character-preview-tooltip";
import type { EpisodeData } from "@/lib/episode-types";

// Rotating color palette for speakers — assigned by order of appearance
const SPEAKER_PALETTE = [
  "text-violet-300",
  "text-sky-300",
  "text-amber-300",
  "text-emerald-300",
  "text-rose-300",
  "text-cyan-300",
];

const speakerColorMap = new Map<string, string>();

function getSpeakerColor(name: string): string {
  if (!speakerColorMap.has(name)) {
    speakerColorMap.set(name, SPEAKER_PALETTE[speakerColorMap.size % SPEAKER_PALETTE.length]);
  }
  return speakerColorMap.get(name)!;
}

interface EpisodeDialogueBoxProps {
  speaker: string | null;
  text: string | null;
  beatIndex: number;
  onTextComplete: () => void;
  onAdvance: () => void;
  onTakeControl?: () => void;
  isVisible: boolean;
  seriesId?: string;
  episodeData?: EpisodeData | null;
}

export function EpisodeDialogueBox({ speaker, text, beatIndex, onTextComplete, onAdvance, onTakeControl, isVisible, seriesId, episodeData }: EpisodeDialogueBoxProps) {
  const [revealedChars, setRevealedChars] = useState(0);

  // Refs survive StrictMode double-execution
  const progressRef = useRef(0);
  const onCompleteRef = useRef(onTextComplete);
  onCompleteRef.current = onTextComplete;

  // Track whether skip was called (ref for immediate visibility across clicks)
  const skippedRef = useRef(false);

  // Derived - no separate state needed
  const isComplete = !text || revealedChars >= text.length;

  // Reset typewriter on every beat change (beatIndex) or text change
  useEffect(() => {
    progressRef.current = 0;
    setRevealedChars(0);
    skippedRef.current = false;

    if (!text) return;

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      progressRef.current += 2;
      if (progressRef.current >= text.length) {
        progressRef.current = text.length;
        setRevealedChars(text.length);
        onCompleteRef.current();
      } else {
        setRevealedChars(progressRef.current);
        setTimeout(tick, 30);
      }
    };

    setTimeout(tick, 30);
    return () => { cancelled = true; };
  }, [text, beatIndex]);

  const skip = () => {
    if (text && !isComplete) {
      progressRef.current = text.length;
      setRevealedChars(text.length);
      skippedRef.current = true;
      onTextComplete();
    }
  };

  const handleClick = () => {
    if (!isComplete && !skippedRef.current) skip();
    else onAdvance();
  };

  if (!isVisible) return null;

  const speakerColor = speaker ? getSpeakerColor(speaker) : "";
  const avatarSrc = speaker && seriesId ? characterToImageSrc(seriesId, speaker, episodeData) : null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 cursor-pointer"
      onClick={handleClick}
    >
      <div className="max-w-3xl mx-auto px-4 pb-6 sm:pb-8">
        <div className="bg-black/70 backdrop-blur-xl rounded-2xl border border-white/10 px-5 py-4 sm:px-6 sm:py-5 shadow-2xl flex flex-col gap-3">
          {speaker && (
            <div className="flex items-center gap-3">
              <CharacterPreviewTooltip
                character={{ name: speaker }}
                imageSrc={avatarSrc}
                position="top"
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt={speaker} className="w-12 h-12 rounded-full object-cover object-top border-2 border-white/20 shadow-lg cursor-pointer flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/5 border-2 border-white/20 flex items-center justify-center shadow-lg cursor-pointer flex-shrink-0">
                    <span className={`text-base font-bold ${speakerColor}`}>{speaker[0]}</span>
                  </div>
                )}
              </CharacterPreviewTooltip>
              <p className={`text-base font-semibold ${speakerColor}`}>{speaker}</p>
            </div>
          )}
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <p className="text-white text-base sm:text-lg leading-relaxed min-h-[3rem]">
                {text ? text.slice(0, revealedChars) : ""}
              </p>
              {isComplete && (
                <p className="text-white/30 text-xs mt-2 animate-pulse">Tap to continue</p>
              )}
            </div>
            {isComplete && onTakeControl && (
              <button
                onClick={(e) => { e.stopPropagation(); onTakeControl(); }}
                className="flex-shrink-0 inline-flex items-center gap-2 px-4 h-10 rounded-full bg-violet-600/30 hover:bg-violet-600/40 border border-violet-500/50 text-violet-300 shadow-[0_0_14px_rgba(139,92,246,0.35)] hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] transition-all text-sm font-medium"
                title="Start chat"
              >
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                Start chat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

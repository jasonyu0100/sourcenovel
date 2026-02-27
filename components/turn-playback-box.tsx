"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { SimAction } from "@/lib/simulation-types";

interface TurnPlaybackBoxProps {
  action: SimAction;
  characterName: string;
  characterImage: string;
  characterLocation: string; // display name of current location
  targetLocationName?: string; // resolved name for move targets
  targetCharacterName?: string; // resolved name for interact targets
  targetCharacterImage?: string; // image for interact targets
  turnNumber: number;
  actionIndex: number;
  totalActions: number;
  onAdvance: () => void;
}

export function TurnPlaybackBox({
  action,
  characterName,
  characterImage,
  characterLocation,
  targetLocationName,
  targetCharacterName,
  targetCharacterImage,
  turnNumber,
  actionIndex,
  totalActions,
  onAdvance,
}: TurnPlaybackBoxProps) {
  const [imageError, setImageError] = useState(false);
  const [targetImageError, setTargetImageError] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Keyboard: Space/Enter to advance
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onAdvance();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onAdvance]);

  const moodColors: Record<string, string> = {
    determined: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    tense: "bg-red-500/20 text-red-300 border-red-500/30",
    warm: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    cold: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    playful: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    guarded: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    neutral: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    angry: "bg-red-600/20 text-red-300 border-red-600/30",
    fearful: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    curious: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  };

  const moodClass = moodColors[action.mood] ?? moodColors.neutral;

  const resolvedTarget = targetLocationName ?? action.targetLocation?.replace(/-/g, " ");

  // Reset target image error when action changes
  useEffect(() => {
    setTargetImageError(false);
    setImageError(false);
  }, [action.characterSlug]);

  const resolvedTargetChar = targetCharacterName ?? action.targetCharacter?.replace(/-/g, " ");

  const actionLabel =
    action.actionType === "move" && resolvedTarget
      ? `Traveling to ${resolvedTarget}`
      : action.actionType === "interact" && resolvedTargetChar
        ? `Interacting with ${resolvedTargetChar}`
        : action.actionType === "speak"
          ? "Speaking"
          : action.actionType === "wait"
            ? "Observing"
            : action.actionDetail;

  return (
    <>
      {/* Click backdrop to advance */}
      <div
        className="fixed inset-0 z-30"
        onClick={onAdvance}
      />

      {/* Bottom dialogue box */}
      <div
        ref={boxRef}
        className="fixed bottom-0 inset-x-0 z-40 p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-3xl mx-auto">
          <div className="relative bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            {/* Subtle top gradient line */}
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

            {/* Header: avatar(s) + name + mood */}
            <div className="flex items-center gap-3 mb-3">
              {/* Character avatar(s) */}
              <div className="flex -space-x-2 flex-shrink-0">
                <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 z-10">
                  {!imageError ? (
                    <Image
                      src={characterImage}
                      alt={characterName}
                      fill
                      className="object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {characterName.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                {/* Target character avatar for interact/speak with target */}
                {action.actionType === "interact" && targetCharacterImage && (
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-amber-500/30 z-0 mt-1">
                    {!targetImageError ? (
                      <Image
                        src={targetCharacterImage}
                        alt={resolvedTargetChar ?? ""}
                        fill
                        className="object-cover"
                        onError={() => setTargetImageError(true)}
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                        <span className="text-white font-bold text-xs">
                          {resolvedTargetChar?.charAt(0) ?? "?"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Name + location + action */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {characterName}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                    {actionLabel}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {action.actionType === "move" && resolvedTarget
                    ? `${characterLocation} → ${resolvedTarget}`
                    : characterLocation}
                </p>
              </div>

              {/* Mood badge */}
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${moodClass}`}>
                {action.mood}
              </span>
            </div>

            {/* Narration */}
            <p className="text-sm text-slate-200 leading-relaxed mb-2">
              {action.narration}
            </p>

            {/* Dialogue */}
            {action.dialogue && (
              <p className="text-sm text-amber-300/90 italic pl-3 border-l-2 border-amber-500/30 mb-2">
                &ldquo;{action.dialogue}&rdquo;
              </p>
            )}

            {/* Advance button */}
            <div className="flex items-center justify-end mt-3">
              <button
                onClick={onAdvance}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
              >
                {actionIndex < totalActions - 1 ? "Next" : "Continue"}
                <span className="text-[10px]">▸</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

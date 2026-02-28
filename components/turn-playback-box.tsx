"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { SimAction } from "@/lib/simulation-types";

interface TurnPlaybackBoxProps {
  action: SimAction;
  characterName: string;
  characterImage: string;
  characterLocation: string;
  targetLocationName?: string;
  targetCharacterName?: string;
  targetCharacterImage?: string;
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
    <div className="fixed bottom-14 inset-x-0 z-40 flex justify-center pointer-events-none">
      <div
        ref={boxRef}
        className="bg-[#0f0f18]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-fade-in pointer-events-auto"
        onClick={onAdvance}
      >
        <div className="flex items-start gap-4 p-4">
          {/* Character avatar */}
          <div className="flex items-center -space-x-3 flex-shrink-0">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 relative">
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
                  <span className="text-white font-bold text-sm">{characterName.charAt(0)}</span>
                </div>
              )}
            </div>
            {action.actionType === "interact" && targetCharacterImage && (
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-amber-500/30 relative">
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
                    <span className="text-white font-bold text-xs">{resolvedTargetChar?.charAt(0) ?? "?"}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-white">{characterName}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${moodClass}`}>
                {action.mood}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">
                {actionLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-1.5">
              {action.actionType === "move" && resolvedTarget
                ? `${characterLocation} → ${resolvedTarget}`
                : characterLocation}
            </p>

            <p className="text-sm text-slate-200 leading-relaxed">
              {action.narration}
            </p>

            {action.dialogue && (
              <p className="text-sm text-amber-300/80 italic pl-3 border-l-2 border-amber-500/30 mt-2">
                &ldquo;{action.dialogue}&rdquo;
              </p>
            )}
          </div>

          {/* Right: counter + advance */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className="text-[10px] text-slate-600 tabular-nums">
              {actionIndex + 1}/{totalActions}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onAdvance(); }}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              {actionIndex < totalActions - 1 ? "Next" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

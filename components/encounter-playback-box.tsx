"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import type { SimAction, EncounterType } from "@/lib/simulation-types";

interface ConversationLine {
  speaker: string;
  speakerSlug: string;
  line: string;
  type: "dialogue" | "action" | "thought";
}

interface EncounterCharacter {
  slug: string;
  name: string;
  image: string;
  mood: string;
}

interface EncounterPlaybackBoxProps {
  locationName: string;
  encounterType?: EncounterType;
  characters: EncounterCharacter[];
  actions: SimAction[];
  conversation: ConversationLine[] | null;
  conversationLoading: boolean;
  onAdvance: () => void;
}

export function EncounterPlaybackBox({
  locationName,
  encounterType = "convergence",
  characters,
  actions,
  conversation,
  conversationLoading,
  onAdvance,
}: EncounterPlaybackBoxProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [visibleLines, setVisibleLines] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset visible lines when conversation changes
  useEffect(() => {
    setVisibleLines(0);
  }, [conversation]);

  // Auto-reveal first line once conversation loads
  useEffect(() => {
    if (conversation && conversation.length > 0 && visibleLines === 0) {
      setVisibleLines(1);
    }
  }, [conversation, visibleLines]);

  // Scroll to bottom when new lines appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLines]);

  const handleAdvance = () => {
    if (conversationLoading) return;

    if (conversation && visibleLines < conversation.length) {
      setVisibleLines((v) => v + 1);
    } else {
      onAdvance();
    }
  };

  // Keyboard: Space/Enter to advance
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleAdvance();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleAdvance]);

  const handleImageError = (slug: string) => {
    setImageErrors((prev) => new Set(prev).add(slug));
  };

  const getCharColor = (slug: string): string => {
    const colors = [
      "text-amber-200",
      "text-cyan-200",
      "text-rose-200",
      "text-emerald-200",
      "text-violet-200",
    ];
    const idx = characters.findIndex((c) => c.slug === slug);
    return colors[idx % colors.length];
  };

  const getCharBorderColor = (slug: string): string => {
    const colors = [
      "border-amber-500/40",
      "border-cyan-500/40",
      "border-rose-500/40",
      "border-emerald-500/40",
      "border-violet-500/40",
    ];
    const idx = characters.findIndex((c) => c.slug === slug);
    return colors[idx % colors.length];
  };

  const allRevealed = conversation ? visibleLines >= conversation.length : false;

  return (
    <>
      {/* Top-right encounter legend */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-2">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm border ${
          encounterType === "crossover"
            ? "bg-rose-500/15 border-rose-400/30"
            : encounterType === "near-miss"
              ? "bg-orange-500/15 border-orange-400/30"
              : "bg-amber-500/15 border-amber-400/30"
        }`}>
          <span className="text-xs">
            {encounterType === "crossover" ? "⚔" : encounterType === "near-miss" ? "💨" : "⚡"}
          </span>
          <span className={`text-xs font-medium ${
            encounterType === "crossover"
              ? "text-rose-300"
              : encounterType === "near-miss"
                ? "text-orange-300"
                : "text-amber-300"
          }`}>
            {encounterType === "crossover"
              ? `Paths crossed — ${locationName}`
              : encounterType === "near-miss"
                ? `Near miss at ${locationName}`
                : `Encounter at ${locationName}`}
          </span>
        </div>
      </div>

      {/* Click backdrop to advance */}
      <div
        className="fixed inset-0 z-30"
        onClick={handleAdvance}
      />

      {/* Bottom encounter box */}
      <div
        className="fixed bottom-0 inset-x-0 z-40 p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-3xl mx-auto">
          <div className={`relative bg-black/85 backdrop-blur-xl border rounded-2xl p-5 shadow-2xl ${
            encounterType === "crossover"
              ? "border-rose-500/25"
              : encounterType === "near-miss"
                ? "border-orange-500/25"
                : "border-amber-500/25"
          }`}>
            {/* Pulsing top gradient */}
            <div className={`absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent to-transparent animate-pulse ${
              encounterType === "crossover"
                ? "via-rose-500/60"
                : encounterType === "near-miss"
                  ? "via-orange-500/60"
                  : "via-amber-500/60"
            }`} />

            {/* Character avatars row */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex -space-x-2">
                {characters.map((char) => (
                  <div
                    key={char.slug}
                    className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-amber-500/40 flex-shrink-0"
                  >
                    {!imageErrors.has(char.slug) ? (
                      <Image
                        src={char.image}
                        alt={char.name}
                        fill
                        className="object-cover"
                        onError={() => handleImageError(char.slug)}
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                        <span className="text-white font-bold text-xs">
                          {char.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-amber-200">
                  {characters.map((c) => c.name).join(" & ")}
                </span>
                <p className={`text-[10px] uppercase tracking-wider ${
                  encounterType === "crossover"
                    ? "text-rose-400/60"
                    : encounterType === "near-miss"
                      ? "text-orange-400/60"
                      : "text-amber-400/60"
                }`}>
                  {encounterType === "crossover"
                    ? `Crossed paths — ${locationName}`
                    : encounterType === "near-miss"
                      ? `Just missed each other at ${locationName}`
                      : `Converged at ${locationName}`}
                </p>
              </div>
            </div>

            {/* Conversation or loading */}
            {conversationLoading ? (
              <div className="flex items-center gap-3 py-6 justify-center">
                <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
                <span className="text-sm text-amber-300/60">
                  {encounterType === "crossover"
                    ? "Their paths intersect..."
                    : encounterType === "near-miss"
                      ? "A fleeting moment..."
                      : "The characters notice each other..."}
                </span>
              </div>
            ) : conversation && conversation.length > 0 ? (
              <div
                ref={scrollRef}
                className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin"
              >
                {conversation.slice(0, visibleLines).map((line, i) => {
                  const char = characters.find((c) => c.slug === line.speakerSlug);
                  const isLast = i === visibleLines - 1;

                  if (line.type === "action") {
                    return (
                      <div
                        key={i}
                        className={`text-sm text-slate-400 italic pl-3 transition-opacity duration-300 ${isLast ? "animate-fade-in" : ""}`}
                      >
                        <span className={getCharColor(line.speakerSlug)}>
                          {line.speaker}
                        </span>{" "}
                        {line.line}
                      </div>
                    );
                  }

                  if (line.type === "thought") {
                    return (
                      <div
                        key={i}
                        className={`text-sm text-slate-500 italic pl-3 border-l-2 border-slate-700 transition-opacity duration-300 ${isLast ? "animate-fade-in" : ""}`}
                      >
                        <span className="text-slate-400 text-xs mr-1">
                          {line.speaker}&apos;s thoughts:
                        </span>{" "}
                        {line.line}
                      </div>
                    );
                  }

                  // dialogue
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-2.5 transition-opacity duration-300 ${isLast ? "animate-fade-in" : ""}`}
                    >
                      {/* Small avatar */}
                      <div className={`relative w-7 h-7 rounded-full overflow-hidden border ${getCharBorderColor(line.speakerSlug)} flex-shrink-0 mt-0.5`}>
                        {char && !imageErrors.has(char.slug) ? (
                          <Image
                            src={char.image}
                            alt={line.speaker}
                            fill
                            className="object-cover"
                            onError={() => handleImageError(line.speakerSlug)}
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                            <span className="text-white font-bold text-[9px]">
                              {line.speaker.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-medium ${getCharColor(line.speakerSlug)}`}>
                          {line.speaker}
                        </span>
                        <p className="text-sm text-slate-200 leading-relaxed mt-0.5">
                          &ldquo;{line.line}&rdquo;
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Fallback: show individual actions like before */
              <div className="space-y-3">
                {characters.map((char) => {
                  const charAction = actions.find(
                    (a) => a.characterSlug === char.slug,
                  );
                  if (!charAction) return null;

                  return (
                    <div key={char.slug} className="pl-3 border-l-2 border-white/10">
                      <span className="text-xs font-medium text-white/80">
                        {char.name}
                      </span>
                      <p className="text-sm text-slate-300 leading-relaxed mt-0.5">
                        {charAction.narration}
                      </p>
                      {charAction.dialogue && (
                        <p className="text-sm text-amber-300/90 italic mt-1">
                          &ldquo;{charAction.dialogue}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Advance button */}
            <div className="flex items-center justify-between mt-4">
              {conversation && conversation.length > 0 && (
                <span className="text-[10px] text-slate-500">
                  {visibleLines} / {conversation.length}
                </span>
              )}
              <div className="flex-1" />
              <button
                onClick={handleAdvance}
                disabled={conversationLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-amber-200/80 hover:text-amber-100 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-all disabled:opacity-30"
              >
                {conversationLoading
                  ? "Loading..."
                  : allRevealed
                    ? "Continue"
                    : "Next"}
                <span className="text-[10px]">&#9654;</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

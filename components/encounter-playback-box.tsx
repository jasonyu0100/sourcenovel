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
  const [skipped, setSkipped] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset visible lines and skip state when conversation changes
  useEffect(() => {
    setVisibleLines(0);
    setSkipped(false);
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

  const buildSummary = (lines: ConversationLine[]): string => {
    const speakers = Array.from(new Set(lines.map((l) => l.speaker)));
    const dialogueLines = lines.filter((l) => l.type === "dialogue");
    const actionLines = lines.filter((l) => l.type === "action");
    const parts: string[] = [];

    if (dialogueLines.length > 0) {
      parts.push(`${speakers.join(" and ")} exchanged ${dialogueLines.length} lines of dialogue`);
    }
    if (actionLines.length > 0) {
      const lastAction = actionLines[actionLines.length - 1];
      parts.push(`${lastAction.speaker} ${lastAction.line}`);
    }
    if (dialogueLines.length > 0) {
      const last = dialogueLines[dialogueLines.length - 1];
      parts.push(`${last.speaker}'s parting words: "${last.line}"`);
    }
    return parts.join(". ") + ".";
  };

  const handleSkip = () => {
    if (!conversation || conversation.length === 0) return;
    setSkipped(true);
  };

  const handleAdvance = () => {
    if (conversationLoading) return;

    if (skipped) {
      onAdvance();
    } else if (conversation && visibleLines < conversation.length) {
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

  const encounterLabel =
    encounterType === "crossover"
      ? "Crossed Paths"
      : encounterType === "near-miss"
        ? "Near Miss"
        : "Convergence";

  const encounterLabelColor =
    encounterType === "crossover"
      ? "text-rose-400"
      : encounterType === "near-miss"
        ? "text-orange-400"
        : "text-violet-400";

  return (
    <div className="fixed bottom-14 inset-x-0 z-40 flex justify-center pointer-events-none">
      <div
        className="bg-[#0f0f18]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-fade-in pointer-events-auto"
        onClick={handleAdvance}
      >
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          {/* Character avatars */}
          <div className="flex -space-x-2 flex-shrink-0">
            {characters.map((char) => (
              <div
                key={char.slug}
                className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-white/20"
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
                    <span className="text-white font-bold text-xs">{char.name.charAt(0)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] uppercase tracking-widest ${encounterLabelColor}`}>
                {encounterLabel}
              </span>
              <span className="text-[9px] text-slate-600">at {locationName}</span>
            </div>
            <span className="text-sm font-semibold text-white">
              {characters.map((c) => c.name).join(" & ")}
            </span>
          </div>

          {/* Counter + controls */}
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {conversation && conversation.length > 0 && !skipped && (
              <span className="text-[10px] text-slate-600 tabular-nums">
                {visibleLines}/{conversation.length}
              </span>
            )}
            {conversation && conversation.length > 0 && !allRevealed && !skipped && (
              <button
                onClick={handleSkip}
                className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              >
                Skip
              </button>
            )}
            <button
              onClick={handleAdvance}
              disabled={conversationLoading}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              {conversationLoading
                ? "Loading..."
                : allRevealed || skipped
                  ? "Continue"
                  : "Next"}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          {conversationLoading ? (
            <div className="flex items-center gap-3 py-3 justify-center">
              <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
              <span className="text-xs text-slate-400 italic">
                {encounterType === "crossover"
                  ? "Their paths intersect..."
                  : encounterType === "near-miss"
                    ? "A fleeting moment..."
                    : "The characters notice each other..."}
              </span>
            </div>
          ) : skipped && conversation && conversation.length > 0 ? (
            <div className="py-2 animate-fade-in">
              <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Summary</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {buildSummary(conversation)}
              </p>
            </div>
          ) : conversation && conversation.length > 0 ? (
            <div
              ref={scrollRef}
              className="space-y-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin"
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
                    <div className={`relative w-6 h-6 rounded-full overflow-hidden border ${getCharBorderColor(line.speakerSlug)} flex-shrink-0 mt-0.5`}>
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
                          <span className="text-white font-bold text-[8px]">
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
            /* Fallback: show individual actions */
            <div className="space-y-2">
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
                      <p className="text-sm text-amber-300/80 italic mt-1">
                        &ldquo;{charAction.dialogue}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

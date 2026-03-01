"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import type { SimTurnResult, SimCharacterState, SimAction } from "@/lib/simulation-types";
import type { WorldMapLocation } from "@/lib/world-types";

// --- Circular Timer ---

function CircularTimer({
  value,
  progress,
  color,
  label,
  onClick,
  title,
}: {
  value: string;
  progress: number; // 0 to 1
  color: string; // CSS rgba color for the arc
  label?: string; // override displayed text
  onClick?: () => void;
  title?: string;
}) {
  const circumference = 2 * Math.PI * 13;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="relative w-8 h-8 flex items-center justify-center"
      title={title}
    >
      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
        <circle
          cx="16" cy="16" r="13"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="2"
        />
        <circle
          cx="16" cy="16" r="13"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${circumference * (1 - progress)}`}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <span className="absolute text-[9px] font-medium tabular-nums text-slate-400">
        {label ?? value}
      </span>
    </Tag>
  );
}

// --- Turn Detail Modal ---

function TurnDetailModal({
  turnResult,
  locations,
  scenarioCharacters,
  onClose,
}: {
  turnResult: SimTurnResult;
  locations: WorldMapLocation[];
  scenarioCharacters: { slug: string; name: string }[];
  onClose: () => void;
}) {
  const locationMap = new Map(locations.map((l) => [l.slug, l]));
  const charName = (slug: string) =>
    scenarioCharacters.find((c) => c.slug === slug)?.name ?? slug;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#0f0f18] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-violet-400">
              Turn {turnResult.turn}
            </span>
            <h2 className="text-lg font-semibold text-white mt-0.5">What Happened</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">World Narration</h3>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{turnResult.worldNarration}</p>
          </div>
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Character Actions</h3>
            <div className="space-y-4">
              {turnResult.actions.map((action, i) => {
                const targetLocName = action.targetLocation
                  ? locationMap.get(action.targetLocation)?.name ?? action.targetLocation
                  : null;
                return (
                  <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-white">{charName(action.characterSlug)}</span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                        {action.actionType}{targetLocName ? ` → ${targetLocName}` : ""}
                      </span>
                      <span className="ml-auto text-[10px] text-slate-600">{action.mood}</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed mb-2">{action.narration}</p>
                    {action.dialogue && (
                      <p className="text-sm text-amber-300/80 italic pl-3 border-l-2 border-amber-500/30">
                        &ldquo;{action.dialogue}&rdquo;
                      </p>
                    )}
                    {action.innerThought && (
                      <p className="text-xs text-slate-500 italic mt-2 pl-3 border-l-2 border-slate-700">
                        Thinking: {action.innerThought}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Influence Modal ---

function InfluenceModal({
  characterSlug,
  characterName,
  currentMood,
  currentLocation,
  onSubmit,
  onClose,
}: {
  characterSlug: string;
  characterName: string;
  currentMood: string;
  currentLocation: string;
  onSubmit: (charSlug: string, influence: string) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (input.trim()) {
      onSubmit(characterSlug, input.trim());
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#0f0f18] border border-violet-500/20 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/10">
          <span className="text-[10px] uppercase tracking-widest text-violet-400">Divine Influence</span>
          <h2 className="text-base font-semibold text-white mt-0.5">Whisper to {characterName}</h2>
          <p className="text-xs text-slate-500 mt-1">At {currentLocation} · Mood: {currentMood}</p>
        </div>
        <div className="p-6">
          <p className="text-xs text-slate-400 mb-3">
            Guide this character&apos;s next action. They may follow your suggestion or resist based on their personality and goals.
          </p>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Go to the DriftNet Lounge and confront Sera about the recall orders..."
            className="w-full h-24 px-3 py-2 text-sm bg-white/[0.03] border border-white/10 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={!input.trim()} className="px-4 py-1.5 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 transition-colors">Influence</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Right Side Panel (Civ 6 style) ---

function RightPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed right-0 top-0 bottom-14 w-80 z-30 flex flex-col bg-black/75 backdrop-blur-xl border-l border-white/10 animate-in slide-in-from-right-full duration-200"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-medium">{title}</span>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 flex items-center justify-center text-xs transition-colors"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

// --- Main Bottom Bar ---

interface SimulationBottomBarProps {
  seriesId: string;
  turn: number;
  status: "active" | "paused" | "complete";
  characters: SimCharacterState[];
  turnLog: SimTurnResult[];
  locations: WorldMapLocation[];
  scenarioCharacters: { slug: string; name: string }[];
  isProcessing: boolean;
  influences: Map<string, string>;
  onSetInfluence: (charSlug: string, influence: string) => void;
  onClearInfluence: (charSlug: string) => void;
  onAdvanceTurn: () => void;
  onPause: () => void;
  onResume: () => void;
  viewingTurn: number | null;
  onViewTurn: (turn: number | null) => void;
  roleplayCharacters: Set<string>;
  onToggleRoleplay: (charSlug: string) => void;
}

export function SimulationBottomBar({
  seriesId,
  turn,
  status,
  characters,
  turnLog,
  locations,
  scenarioCharacters,
  isProcessing,
  influences,
  onSetInfluence,
  onClearInfluence,
  onAdvanceTurn,
  onPause,
  onResume,
  viewingTurn,
  onViewTurn,
  roleplayCharacters,
  onToggleRoleplay,
}: SimulationBottomBarProps) {
  const [panel, setPanel] = useState<"log" | "characters" | null>(null);
  const [detailTurn, setDetailTurn] = useState<SimTurnResult | null>(null);
  const [influenceTarget, setInfluenceTarget] = useState<string | null>(null);
  const [narrativeExpanded, setNarrativeExpanded] = useState(true);

  // Latest turn for narrative display
  const latestTurn = turnLog.length > 0 ? turnLog[turnLog.length - 1] : null;

  // Resolving elapsed timer
  const [resolvingElapsed, setResolvingElapsed] = useState(0);
  const resolvingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isProcessing) {
      setResolvingElapsed(0);
      resolvingRef.current = setInterval(() => {
        setResolvingElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (resolvingRef.current) {
        clearInterval(resolvingRef.current);
        resolvingRef.current = null;
      }
    }
    return () => {
      if (resolvingRef.current) {
        clearInterval(resolvingRef.current);
        resolvingRef.current = null;
      }
    };
  }, [isProcessing]);

  // Auto-advance countdown timer
  const TURN_DURATION = 30; // seconds between auto-advance
  const [countdown, setCountdown] = useState(TURN_DURATION);
  const [timerPaused, setTimerPaused] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset countdown when turn changes
  useEffect(() => {
    setCountdown(TURN_DURATION);
  }, [turn]);

  // Tick the countdown
  useEffect(() => {
    if (isProcessing || status !== "active" || timerPaused || (viewingTurn !== null && viewingTurn < turn)) {
      // Clear interval when paused/processing/viewing history
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [isProcessing, status, timerPaused, viewingTurn, turn]);

  // Auto-advance when countdown hits 0
  useEffect(() => {
    if (countdown === 0 && !isProcessing && status === "active" && !timerPaused) {
      onAdvanceTurn();
    }
  }, [countdown, isProcessing, status, timerPaused, onAdvanceTurn]);

  const isViewingHistory = viewingTurn !== null && viewingTurn < turn;
  const activeInfluences = influences.size;
  const timerProgress = countdown / TURN_DURATION; // 1 → 0

  const locationMap = new Map(locations.map((l) => [l.slug, l]));
  const charName = (slug: string) =>
    scenarioCharacters.find((c) => c.slug === slug)?.name ?? slug;

  const influenceChar = influenceTarget
    ? characters.find((c) => c.characterSlug === influenceTarget)
    : null;

  const togglePanel = (target: "log" | "characters") => {
    setPanel((prev) => (prev === target ? null : target));
  };

  return (
    <>
      {/* ─── Narrative Panel (shows latest turn prose) ─── */}
      {latestTurn && !isProcessing && (
        <div className={`fixed bottom-12 inset-x-0 z-20 transition-all duration-300 ${
          narrativeExpanded ? "max-h-[50vh]" : "max-h-0"
        } overflow-hidden`}>
          <div className="bg-[#0a0a12]/95 backdrop-blur-xl border-t border-white/[0.07]">
            <div className="max-w-3xl mx-auto px-6 py-4 max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
              {/* World narration */}
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line mb-4">
                {latestTurn.worldNarration}
              </p>

              {/* Per-character narration cards */}
              <div className="space-y-3">
                {latestTurn.actions.map((action: SimAction, i: number) => {
                  const targetLocName = action.targetLocation
                    ? locationMap.get(action.targetLocation)?.name ?? action.targetLocation
                    : null;
                  return (
                    <div key={i} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-medium text-white">{charName(action.characterSlug)}</span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-600">
                          {action.actionType === "move" && targetLocName
                            ? `→ ${targetLocName}`
                            : action.mood}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{action.narration}</p>
                      {action.dialogue && (
                        <p className="text-xs text-amber-300/80 italic mt-1.5 pl-3 border-l-2 border-amber-500/30">
                          &ldquo;{action.dialogue}&rdquo;
                        </p>
                      )}
                      {action.innerThought && (
                        <p className="text-[10px] text-slate-600 italic mt-1 pl-3 border-l-2 border-slate-800">
                          {action.innerThought}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bottom HUD Strip ─── */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-[#0a0a12]/90 backdrop-blur-xl border-t border-white/[0.07]">
        <div className="px-4 h-12 flex items-center gap-2">

          {/* Left: Status + Turn */}
          <div className="flex items-center gap-2 mr-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isProcessing
                  ? "bg-violet-400 animate-pulse"
                  : status === "active"
                    ? "bg-emerald-400"
                    : status === "paused"
                      ? "bg-amber-400"
                      : "bg-slate-500"
              }`}
            />
            <span className="text-[11px] font-medium text-slate-300 tabular-nums">
              Turn {isViewingHistory ? `${viewingTurn}/${turn}` : turn}
            </span>
            {isViewingHistory && (
              <button
                onClick={() => onViewTurn(null)}
                className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                → Present
              </button>
            )}
          </div>

          {/* Center: Turn scrubber */}
          {turnLog.length > 0 ? (
            <div className="flex items-center gap-1 flex-1 max-w-sm mx-auto justify-center">
              <button
                disabled={(viewingTurn ?? turn) <= 1}
                onClick={() => {
                  const current = viewingTurn ?? turn;
                  onViewTurn(current - 1 >= turn ? null : current - 1);
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors text-xs"
              >
                ◀
              </button>
              <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide px-1">
                {turnLog.map((t) => {
                  const isActive = (viewingTurn ?? turn) === t.turn;
                  const isCurrent = t.turn === turn;
                  return (
                    <button
                      key={t.turn}
                      onClick={() => onViewTurn(isCurrent ? null : t.turn)}
                      className={`h-6 min-w-[24px] px-1.5 rounded text-[10px] font-medium tabular-nums transition-colors ${
                        isActive
                          ? "bg-violet-500/25 text-violet-300 border border-violet-500/40"
                          : "text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] border border-transparent"
                      }`}
                      title={`Turn ${t.turn}${isCurrent ? " (current)" : ""}`}
                    >
                      {t.turn}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={viewingTurn === null || viewingTurn >= turn}
                onClick={() => {
                  const next = (viewingTurn ?? turn) + 1;
                  onViewTurn(next >= turn ? null : next);
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors text-xs"
              >
                ▶
              </button>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* Right: Action buttons */}
          <div className="flex items-center gap-1.5 ml-2">
            {/* Narrative toggle */}
            {latestTurn && (
              <button
                onClick={() => setNarrativeExpanded((p) => !p)}
                className={`h-8 px-2.5 text-[10px] uppercase tracking-wider rounded-md border transition-colors ${
                  narrativeExpanded
                    ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                    : "bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                Story
              </button>
            )}

            {/* History panel toggle */}
            <button
              onClick={() => togglePanel("log")}
              className={`h-8 px-2.5 text-[10px] uppercase tracking-wider rounded-md border transition-colors ${
                panel === "log"
                  ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                  : "bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              Log{turnLog.length > 0 ? ` ${turnLog.length}` : ""}
            </button>

            {/* Characters panel toggle */}
            <button
              onClick={() => togglePanel("characters")}
              className={`h-8 px-2.5 text-[10px] uppercase tracking-wider rounded-md border transition-colors ${
                panel === "characters"
                  ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                  : activeInfluences > 0
                    ? "bg-violet-500/10 border-violet-500/20 text-violet-400 hover:bg-violet-500/15"
                    : "bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              Characters{activeInfluences > 0 ? ` ✦${activeInfluences}` : ""}
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-white/[0.07] mx-1" />

            {/* Pause / Resume */}
            {!isViewingHistory && status === "active" && (
              <button
                onClick={() => {
                  setTimerPaused(true);
                  onPause();
                }}
                className="h-8 px-2 text-[10px] uppercase tracking-wider rounded-md bg-white/[0.03] border border-white/[0.07] text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                Pause
              </button>
            )}
            {!isViewingHistory && status === "paused" && (
              <button
                onClick={() => {
                  setTimerPaused(false);
                  onResume();
                }}
                className="h-8 px-2 text-[10px] uppercase tracking-wider rounded-md bg-white/[0.03] border border-white/[0.07] text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                Resume
              </button>
            )}

            {/* Timer + Next Turn */}
            {!isViewingHistory && (
              <div className="flex items-center gap-2">
                {/* Circular timer: resolving or countdown */}
                {isProcessing ? (
                  <CircularTimer
                    value={`${resolvingElapsed}`}
                    progress={Math.min(resolvingElapsed / 30, 1)}
                    color="rgba(251,146,60,0.6)"
                    title={`Resolving... ${resolvingElapsed}s`}
                  />
                ) : status === "active" && (
                  <CircularTimer
                    value={`${countdown}`}
                    progress={timerProgress}
                    color={timerPaused ? "rgba(251,191,36,0.5)" : "rgba(139,92,246,0.6)"}
                    label={timerPaused ? "||" : undefined}
                    onClick={() => setTimerPaused((p) => !p)}
                    title={timerPaused ? "Resume timer" : "Pause timer"}
                  />
                )}

                {/* Next Turn button */}
                <button
                  onClick={() => {
                    setCountdown(TURN_DURATION);
                    onAdvanceTurn();
                  }}
                  disabled={isProcessing || status !== "active"}
                  className="h-8 px-4 text-[10px] uppercase tracking-wider font-semibold rounded-md bg-violet-600 border border-violet-500/50 text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? "Resolving..." : "Next Turn"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Right Side Panels (Civ 6 style) ─── */}

      {panel === "log" && (
        <RightPanel title="Turn History" onClose={() => setPanel(null)}>
          <div className="p-3 space-y-2">
            {turnLog.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-8">No turns yet.</p>
            ) : (
              turnLog
                .filter((t) => !isViewingHistory || t.turn <= (viewingTurn ?? turn))
                .map((t) => (
                  <button
                    key={t.turn}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      (viewingTurn ?? turn) === t.turn
                        ? "border-violet-500/30 bg-violet-500/5"
                        : "border-white/[0.04] hover:border-white/10 hover:bg-white/[0.02]"
                    }`}
                    onClick={() => setDetailTurn(t)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-violet-400 font-medium">
                        Turn {t.turn}
                      </span>
                      <span className="text-[9px] text-slate-600">{t.actions.length} actions</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {t.worldNarration}
                    </p>
                  </button>
                ))
            )}
          </div>
        </RightPanel>
      )}

      {panel === "characters" && (
        <RightPanel title="Characters" onClose={() => setPanel(null)}>
          <div className="p-3 space-y-2">
            {characters.map((char) => {
              const loc = locationMap.get(char.locationSlug);
              const name = charName(char.characterSlug);
              const hasInfluence = influences.has(char.characterSlug);
              const isRoleplay = roleplayCharacters.has(char.characterSlug);
              return (
                <div
                  key={char.characterSlug}
                  className={`p-3 rounded-lg border transition-colors ${
                    isRoleplay
                      ? "border-amber-500/30 bg-amber-500/5"
                      : hasInfluence
                        ? "border-violet-500/25 bg-violet-500/5"
                        : "border-white/[0.04] bg-white/[0.01]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`w-9 h-9 rounded-full overflow-hidden flex-shrink-0 relative border ${
                      isRoleplay ? "border-amber-400/50" : "border-white/15"
                    }`}>
                      <Image
                        src={`/series/${seriesId}/world/characters/${char.characterSlug}.jpg`}
                        alt={name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-white block truncate">{name}</span>
                        {isRoleplay && (
                          <span className="text-[8px] uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">
                            You
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span>{loc?.name ?? char.locationSlug}</span>
                        <span className="text-slate-700">·</span>
                        <span>{char.mood}</span>
                      </div>
                    </div>
                  </div>

                  {char.lastAction && (
                    <p className="text-[10px] text-slate-600 mb-2 line-clamp-1">
                      Last: {char.lastAction}
                    </p>
                  )}

                  {hasInfluence && !isRoleplay && (
                    <div className="flex items-start gap-2 mb-2 px-2 py-1.5 rounded bg-violet-500/5 border border-violet-500/10">
                      <p className="text-[10px] text-violet-300 italic flex-1 line-clamp-2">
                        ✦ {influences.get(char.characterSlug)}
                      </p>
                      <button
                        onClick={() => onClearInfluence(char.characterSlug)}
                        className="text-[9px] text-slate-600 hover:text-slate-300 shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onToggleRoleplay(char.characterSlug)}
                      disabled={isViewingHistory}
                      className={`flex-1 h-7 text-[9px] uppercase tracking-[0.15em] rounded border transition-colors ${
                        isRoleplay
                          ? "bg-amber-500/20 border-amber-500/30 text-amber-200 hover:bg-amber-500/30"
                          : "bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]"
                      } disabled:opacity-25`}
                    >
                      {isRoleplay ? "Roleplaying" : "Roleplay"}
                    </button>
                    {!isRoleplay && (
                      <button
                        onClick={() => setInfluenceTarget(char.characterSlug)}
                        disabled={isViewingHistory}
                        className="flex-1 h-7 text-[9px] uppercase tracking-[0.15em] rounded bg-violet-600/15 border border-violet-500/15 text-violet-300 hover:bg-violet-600/25 hover:text-violet-200 disabled:opacity-25 transition-colors"
                      >
                        {hasInfluence ? "Influence" : "Influence"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </RightPanel>
      )}

      {/* ─── Modals ─── */}

      {detailTurn && (
        <TurnDetailModal
          turnResult={detailTurn}
          locations={locations}
          scenarioCharacters={scenarioCharacters}
          onClose={() => setDetailTurn(null)}
        />
      )}

      {influenceTarget && influenceChar && (
        <InfluenceModal
          characterSlug={influenceTarget}
          characterName={charName(influenceTarget)}
          currentMood={influenceChar.mood}
          currentLocation={locationMap.get(influenceChar.locationSlug)?.name ?? influenceChar.locationSlug}
          onSubmit={onSetInfluence}
          onClose={() => setInfluenceTarget(null)}
        />
      )}
    </>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import type { SimTurnResult, SimCharacterState, SimAction } from "@/lib/simulation-types";
import type { WorldMapLocation } from "@/lib/world-types";

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
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-violet-400">
              Turn {turnResult.turn}
            </span>
            <h2 className="text-lg font-semibold text-white mt-0.5">
              What Happened
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* World narration */}
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
              World Narration
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
              {turnResult.worldNarration}
            </p>
          </div>

          {/* Individual character actions */}
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">
              Character Actions
            </h3>
            <div className="space-y-4">
              {turnResult.actions.map((action, i) => (
                <CharacterActionCard
                  key={i}
                  action={action}
                  charName={charName(action.characterSlug)}
                  locationMap={locationMap}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CharacterActionCard({
  action,
  charName,
  locationMap,
}: {
  action: SimAction;
  charName: string;
  locationMap: Map<string, WorldMapLocation>;
}) {
  const targetLocName = action.targetLocation
    ? locationMap.get(action.targetLocation)?.name ?? action.targetLocation
    : null;

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-white">{charName}</span>
        <span className="text-[9px] uppercase tracking-wider text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
          {action.actionType}
          {targetLocName ? ` → ${targetLocName}` : ""}
        </span>
        <span className="ml-auto text-[10px] text-slate-600">
          {action.mood}
        </span>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed mb-2">
        {action.narration}
      </p>
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
}

// --- Influence Modal (God Mode) ---

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
          <span className="text-[10px] uppercase tracking-widest text-violet-400">
            Divine Influence
          </span>
          <h2 className="text-base font-semibold text-white mt-0.5">
            Whisper to {characterName}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            At {currentLocation} · Mood: {currentMood}
          </p>
        </div>
        <div className="p-6">
          <p className="text-xs text-slate-400 mb-3">
            Guide this character&apos;s next action. They may follow your
            suggestion or resist based on their personality and goals.
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
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="px-4 py-1.5 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
            >
              Influence
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Panel ---

interface SimulationPanelProps {
  turn: number;
  status: "active" | "paused" | "complete";
  characters: SimCharacterState[];
  turnLog: SimTurnResult[];
  locations: WorldMapLocation[];
  scenarioCharacters: { slug: string; name: string }[];
  isProcessing: boolean;
  influences: Map<string, string>; // charSlug -> influence text
  onSetInfluence: (charSlug: string, influence: string) => void;
  onClearInfluence: (charSlug: string) => void;
  onAdvanceTurn: () => void;
  onPause: () => void;
  onResume: () => void;
  viewingTurn: number | null; // which historical turn we're viewing, null = current
  onViewTurn: (turn: number | null) => void;
}

export function SimulationPanel({
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
}: SimulationPanelProps) {
  const [activeTab, setActiveTab] = useState<"log" | "characters">("log");
  const [detailTurn, setDetailTurn] = useState<SimTurnResult | null>(null);
  const [influenceTarget, setInfluenceTarget] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const locationMap = new Map(locations.map((l) => [l.slug, l]));
  const charName = (slug: string) =>
    scenarioCharacters.find((c) => c.slug === slug)?.name ?? slug;

  const isViewingHistory = viewingTurn !== null && viewingTurn < turn;

  // Auto-scroll log to bottom on new turns
  useEffect(() => {
    if (activeTab === "log" && !isViewingHistory) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turnLog.length, activeTab, isViewingHistory]);

  const influenceChar = influenceTarget
    ? characters.find((c) => c.characterSlug === influenceTarget)
    : null;

  return (
    <>
      <div className="absolute right-0 top-0 bottom-0 w-96 z-40 flex flex-col bg-black/80 backdrop-blur-xl border-l border-white/10">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isProcessing
                    ? "bg-violet-400 animate-pulse"
                    : status === "active"
                      ? "bg-emerald-400"
                      : status === "paused"
                        ? "bg-amber-400"
                        : "bg-slate-500"
                }`}
              />
              <span className="text-xs uppercase tracking-wider text-slate-400">
                Turn {isViewingHistory ? `${viewingTurn} / ${turn}` : turn}
              </span>
              {isViewingHistory && (
                <button
                  onClick={() => onViewTurn(null)}
                  className="text-[10px] text-violet-400 hover:text-violet-300"
                >
                  → Present
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              {status === "active" && !isViewingHistory ? (
                <button
                  onClick={onPause}
                  className="px-2 py-1 text-xs rounded bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
                >
                  Pause
                </button>
              ) : status === "paused" && !isViewingHistory ? (
                <button
                  onClick={onResume}
                  className="px-2 py-1 text-xs rounded bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
                >
                  Resume
                </button>
              ) : null}
              {!isViewingHistory && (
                <button
                  onClick={onAdvanceTurn}
                  disabled={isProcessing || status !== "active"}
                  className="px-3 py-1 text-xs rounded bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? "Resolving..." : "Next Turn"}
                </button>
              )}
            </div>
          </div>

          {/* Turn history scrubber */}
          {turnLog.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <button
                disabled={!viewingTurn || viewingTurn <= 1}
                onClick={() =>
                  onViewTurn(
                    Math.max(1, (viewingTurn ?? turn) - 1),
                  )
                }
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
              >
                ◀
              </button>
              <div className="flex-1 flex gap-0.5">
                {turnLog.map((t) => (
                  <button
                    key={t.turn}
                    onClick={() =>
                      onViewTurn(t.turn === turn ? null : t.turn)
                    }
                    className={`flex-1 h-1.5 rounded-full transition-colors ${
                      (viewingTurn ?? turn) === t.turn
                        ? "bg-violet-500"
                        : t.turn <= (viewingTurn ?? turn)
                          ? "bg-white/20"
                          : "bg-white/5"
                    }`}
                    title={`Turn ${t.turn}`}
                  />
                ))}
              </div>
              <button
                disabled={!viewingTurn || viewingTurn >= turn}
                onClick={() => {
                  const next = (viewingTurn ?? turn) + 1;
                  onViewTurn(next >= turn ? null : next);
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
              >
                ▶
              </button>
            </div>
          )}

        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {(["log", "characters"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? "text-white border-b-2 border-violet-500"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Turn Log */}
          {activeTab === "log" && (
            <div className="p-4 space-y-4">
              {turnLog.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No turns yet. Click &quot;Next Turn&quot; to begin the
                  simulation.
                </p>
              ) : (
                turnLog
                  .filter(
                    (t) =>
                      !isViewingHistory || t.turn <= (viewingTurn ?? turn),
                  )
                  .map((t) => (
                    <button
                      key={t.turn}
                      className={`w-full text-left space-y-2 p-3 rounded-lg border transition-colors ${
                        (viewingTurn ?? turn) === t.turn
                          ? "border-violet-500/30 bg-violet-500/5"
                          : "border-transparent hover:border-white/5 hover:bg-white/[0.02]"
                      }`}
                      onClick={() => setDetailTurn(t)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-violet-400 font-medium">
                          Turn {t.turn}
                        </span>
                        <div className="flex-1 h-px bg-white/5" />
                        <span className="text-[9px] text-slate-600">
                          Click for details
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
                        {t.worldNarration}
                      </p>
                    </button>
                  ))
              )}
              <div ref={logEndRef} />
            </div>
          )}

          {/* Characters with influence */}
          {activeTab === "characters" && (
            <div className="p-4 space-y-3">
              {characters.map((char) => {
                const loc = locationMap.get(char.locationSlug);
                const name = charName(char.characterSlug);
                const hasInfluence = influences.has(char.characterSlug);
                return (
                  <div
                    key={char.characterSlug}
                    className={`p-3 rounded-lg border transition-colors ${
                      hasInfluence
                        ? "border-violet-500/30 bg-violet-500/5"
                        : "border-white/5 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">
                        {name}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <div>
                        Location:{" "}
                        <span className="text-slate-400">
                          {loc?.name ?? char.locationSlug}
                        </span>
                      </div>
                      <div>
                        Mood:{" "}
                        <span className="text-slate-400">{char.mood}</span>
                      </div>
                      {char.lastAction && (
                        <div>
                          Last:{" "}
                          <span className="text-slate-400">
                            {char.lastAction}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Influence status */}
                    {hasInfluence && (
                      <div className="mt-2 flex items-start gap-2">
                        <p className="text-[10px] text-violet-300 italic flex-1 line-clamp-2">
                          ✦ {influences.get(char.characterSlug)}
                        </p>
                        <button
                          onClick={() =>
                            onClearInfluence(char.characterSlug)
                          }
                          className="text-[9px] text-slate-600 hover:text-slate-300 shrink-0"
                        >
                          Clear
                        </button>
                      </div>
                    )}

                    {/* Influence button */}
                    <button
                      onClick={() =>
                        setInfluenceTarget(char.characterSlug)
                      }
                      disabled={isViewingHistory}
                      className="mt-2 w-full px-2 py-1.5 text-[10px] uppercase tracking-wider rounded bg-violet-600/20 border border-violet-500/20 text-violet-300 hover:bg-violet-600/30 hover:text-violet-200 disabled:opacity-30 transition-colors"
                    >
                      {hasInfluence ? "Change Influence" : "Influence"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Turn Detail Modal */}
      {detailTurn && (
        <TurnDetailModal
          turnResult={detailTurn}
          locations={locations}
          scenarioCharacters={scenarioCharacters}
          onClose={() => setDetailTurn(null)}
        />
      )}

      {/* Influence Modal */}
      {influenceTarget && influenceChar && (
        <InfluenceModal
          characterSlug={influenceTarget}
          characterName={charName(influenceTarget)}
          currentMood={influenceChar.mood}
          currentLocation={
            locationMap.get(influenceChar.locationSlug)?.name ??
            influenceChar.locationSlug
          }
          onSubmit={onSetInfluence}
          onClose={() => setInfluenceTarget(null)}
        />
      )}
    </>
  );
}

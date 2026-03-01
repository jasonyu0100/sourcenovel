"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, PlayIcon } from "@heroicons/react/24/outline";
import type { WorldMapData } from "@/lib/world-types";
import type { ScenarioData, SimCharacterState, SimTurnResult, SimAction, PlaybackState } from "@/lib/simulation-types";
import { loadWorldMap, loadCharacterProfile, loadAvailableArcs, loadArcScenario, loadScenarioContext } from "@/lib/world-data";
import type { ArcInfo } from "@/lib/world-data";
import { loadInteractiveModule, loadSeriesContext, loadArcContext, loadChapterMemory } from "@/lib/episode-data";
import { ArcSelectionModal } from "@/components/arc-selection-modal";
import { WorldMap } from "@/components/world-map";
import type { CharacterOnMap } from "@/components/world-map";
import { WorldLocation } from "@/components/world-location";
import { SimulationBottomBar } from "@/components/simulation-bottom-bar";
import { TurnPlaybackBox } from "@/components/turn-playback-box";
import { PlayerActionModal } from "@/components/player-action-modal";

type ViewState =
  | { mode: "map" }
  | { mode: "location"; slug: string };

export default function WorldPage() {
  const params = useParams();
  const seriesId = params.series as string;

  const [worldMap, setWorldMap] = useState<WorldMapData | null>(null);
  const [view, setView] = useState<ViewState>({ mode: "map" });
  const [loading, setLoading] = useState(true);

  // Simulation state
  const [simActive, setSimActive] = useState(false);
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [simTurn, setSimTurn] = useState(0);
  const [simStatus, setSimStatus] = useState<"active" | "paused" | "complete">("active");
  const [simCharacters, setSimCharacters] = useState<SimCharacterState[]>([]);
  const [simTurnLog, setSimTurnLog] = useState<SimTurnResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const characterProfilesRef = useRef<Map<string, string>>(new Map());

  // Arc selection
  const [arcList, setArcList] = useState<ArcInfo[]>([]);
  const [showArcSelect, setShowArcSelect] = useState(false);

  // Episode-style story context (loaded on simulation start)
  const [interactiveModule, setInteractiveModule] = useState<string | null>(null);
  const [seriesContext, setSeriesContext] = useState<string | null>(null);
  const [arcContext, setArcContext] = useState<string | null>(null);
  const [chapterMemory, setChapterMemory] = useState<string | null>(null);
  const [scenarioContext, setScenarioContext] = useState<string | null>(null);

  // Game history — accumulated recap of what has happened in the simulation
  const [gameHistory, setGameHistory] = useState("");

  // Streaming thinking steps from LLM reasoning (discrete sentences)
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const thinkingBufferRef = useRef("");


  // God-mode influence: charSlug -> directive text
  const [influences, setInfluences] = useState<Map<string, string>>(new Map());

  // Roleplay: which characters are player-controlled
  const [roleplayCharacters, setRoleplayCharacters] = useState<Set<string>>(new Set());
  const [pendingPlayerAction, setPendingPlayerAction] = useState<{
    characterSlug: string;
    characterName: string;
    characterImage: string;
    locationSlug: string;
    availableMoves: { slug: string; name: string; label: string }[];
    nearbyCharacters: { slug: string; name: string; mood: string }[];
  } | null>(null);
  const playerActionsRef = useRef<Map<string, SimAction>>(new Map());
  const pendingAIPhaseRef = useRef<(() => void) | null>(null);

  // Turn history viewing
  const [viewingTurn, setViewingTurn] = useState<number | null>(null);
  const prevViewingTurnRef = useRef<number | null>(null);

  // Character state history: turn -> character states (for history scrubbing)
  const charHistoryRef = useRef<Map<number, SimCharacterState[]>>(new Map());

  // Turn playback state machine
  const [playback, setPlayback] = useState<PlaybackState>({
    current: { phase: "idle" },
    turnResult: null,
    characterUpdates: [],
    pendingResult: null,
  });
  const isPlaybackActive = playback.current.phase !== "idle";

  useEffect(() => {
    async function load() {
      const [map, arcs] = await Promise.all([
        loadWorldMap(seriesId),
        loadAvailableArcs(seriesId),
      ]);
      if (map) setWorldMap(map);
      setArcList(arcs);
      setLoading(false);
    }
    load();
  }, [seriesId]);

  const handleSelectLocation = useCallback((slug: string) => {
    setView({ mode: "location", slug });
  }, []);

  const handleNavigate = useCallback((slug: string) => {
    setView({ mode: "location", slug });
  }, []);

  const handleBackToMap = useCallback(() => {
    setView({ mode: "map" });
  }, []);

  // Open arc selection modal
  const handleStartSimulation = useCallback(() => {
    setShowArcSelect(true);
  }, []);

  // After user picks an arc, load everything and start
  const handleArcSelected = useCallback(async (arcNum: number) => {
    setShowArcSelect(false);
    if (!worldMap) return;

    const sc = await loadArcScenario(seriesId, arcNum);
    if (!sc) return;

    // Load character profiles + episode-style context in parallel
    const [moduleRes, seriesRes, arcRes, memoryRes, scenarioMd, ...profileResults] = await Promise.all([
      loadInteractiveModule(seriesId),
      loadSeriesContext(seriesId),
      loadArcContext(seriesId, arcNum),
      loadChapterMemory(seriesId, 1),
      loadScenarioContext(seriesId, arcNum),
      ...sc.characters.map((char) => loadCharacterProfile(seriesId, char.profile)),
    ]);

    setInteractiveModule(moduleRes);
    setSeriesContext(seriesRes);
    setArcContext(arcRes);
    setChapterMemory(memoryRes);
    setScenarioContext(scenarioMd);

    sc.characters.forEach((char, i) => {
      if (profileResults[i]) characterProfilesRef.current.set(char.slug, profileResults[i] as string);
    });

    const initialChars = sc.characters.map((c) => ({
      characterSlug: c.slug,
      locationSlug: c.startLocation,
      status: "idle" as const,
      mood: "neutral",
    }));

    setScenario(sc);
    setSimTurn(0);
    setSimStatus("active");
    setSimCharacters(initialChars);
    setSimTurnLog([]);
    setInfluences(new Map());
    setGameHistory("");
    setViewingTurn(null);
    charHistoryRef.current = new Map();
    charHistoryRef.current.set(0, initialChars);
    setSimActive(true);
  }, [seriesId, worldMap]);

  // Helper: flush complete sentences from thinking buffer into steps
  const flushThinkingBuffer = useCallback(() => {
    const buf = thinkingBufferRef.current;
    if (!buf) return;

    // Split on sentence-ending punctuation followed by space/newline, or double newlines
    const sentencePattern = /(?<=[.!?])\s+|(?:\n\n+)/g;
    const parts = buf.split(sentencePattern);

    if (parts.length > 1) {
      // All but last are complete sentences — push them
      const complete = parts.slice(0, -1).map((s) => s.trim()).filter((s) => s.length > 10);
      if (complete.length > 0) {
        setThinkingSteps((prev) => [...prev, ...complete]);
      }
      thinkingBufferRef.current = parts[parts.length - 1];
    }
  }, []);

  // Helper: read SSE stream for thinking + result events
  const readSSEStream = useCallback(async (res: Response): Promise<{ turn: number; actions: SimAction[]; worldNarration: string } | null> => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";
    let currentEvent = "";
    let finalResult: { turn: number; actions: SimAction[]; worldNarration: string } | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop()!;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("event: ")) {
          currentEvent = trimmed.slice(7);
        } else if (trimmed.startsWith("data: ") && currentEvent) {
          try {
            const raw = trimmed.slice(6);
            if (currentEvent === "thinking") {
              thinkingBufferRef.current += raw;
              flushThinkingBuffer();
            } else if (currentEvent === "result") {
              finalResult = JSON.parse(raw);
            }
          } catch (e) {
            console.error("SSE parse error:", e, "raw:", trimmed.slice(6, 200));
          }
          currentEvent = "";
        }
      }
    }

    // Flush any remaining buffer as a final step
    const remaining = thinkingBufferRef.current.trim();
    if (remaining.length > 10) {
      setThinkingSteps((prev) => [...prev, remaining]);
    }
    thinkingBufferRef.current = "";

    return finalResult;
  }, [flushThinkingBuffer]);

  // Run two-phase AI turn: movement → narration (called after all player actions are collected)
  const runAIPhaseAndPlayback = useCallback(async (collectedPlayerActions: Map<string, SimAction>) => {
    if (!scenario || !worldMap) return;

    try {
      const characterContexts = scenario.characters.map((sc) => {
        const state = simCharacters.find((c) => c.characterSlug === sc.slug);
        return {
          slug: sc.slug,
          name: sc.name,
          profile: characterProfilesRef.current.get(sc.slug) ?? sc.personality,
          personality: sc.personality,
          goals: sc.goals,
          faction: sc.faction,
          locationSlug: state?.locationSlug ?? sc.startLocation,
          mood: state?.mood ?? "neutral",
          lastAction: state?.lastAction,
        };
      });

      const locationInfos = worldMap.locations.map((l) => ({
        slug: l.slug,
        name: l.name,
        description: l.description,
        connections: l.connections,
      }));

      // Convert influences map to plain object
      const influenceObj: Record<string, string> = {};
      influences.forEach((v, k) => { influenceObj[k] = v; });

      // Extract player movement decisions from their actions
      const playerMovements = Array.from(collectedPlayerActions.values())
        .filter((a) => a.actionType === "move" && a.targetLocation)
        .map((a) => ({
          characterSlug: a.characterSlug,
          decision: "move" as const,
          targetLocation: a.targetLocation,
        }));

      // Players who chose interact are staying
      const playerStays = Array.from(collectedPlayerActions.values())
        .filter((a) => a.actionType === "interact" || !a.targetLocation)
        .map((a) => ({
          characterSlug: a.characterSlug,
          decision: "stay" as const,
          targetLocation: undefined,
        }));

      const allPlayerMovements = [...playerMovements, ...playerStays];

      // --- Phase 1: Movement (non-streaming, fast) ---
      const movementRes = await fetch("/api/simulation/character-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turn: simTurn,
          characters: characterContexts,
          locations: locationInfos,
          gameHistory,
          influences: influenceObj,
          playerMovements: allPlayerMovements.length > 0 ? allPlayerMovements : undefined,
          scenarioContext,
          arcContext,
          seriesContext,
        }),
      });

      if (!movementRes.ok) {
        console.error("Movement phase failed:", await movementRes.text());
        setIsProcessing(false);
        return;
      }

      const movementResult = await movementRes.json();
      const movements: { characterSlug: string; decision: "move" | "stay"; targetLocation?: string; reasoning: string }[] = movementResult.movements;
      const nextTurn: number = movementResult.turn;

      // Apply movements to get resolved positions
      const resolvedCharacters = characterContexts.map((c) => {
        const movement = movements.find((m) => m.characterSlug === c.slug);
        const newLocation = movement?.decision === "move" && movement.targetLocation
          ? movement.targetLocation
          : c.locationSlug;
        return {
          ...c,
          locationSlug: newLocation,
          movedFrom: newLocation !== c.locationSlug ? c.locationSlug : undefined,
        };
      });

      // Build player actions for narration phase (interactions only, movement already resolved)
      const playerActions = Array.from(collectedPlayerActions.values()).map((a) => ({
        characterSlug: a.characterSlug,
        actionType: a.actionType,
        actionDetail: a.actionDetail,
        targetLocation: a.targetLocation,
        targetCharacter: a.targetCharacter,
        dialogue: a.dialogue,
        innerThought: a.innerThought,
        narration: a.narration,
        mood: a.mood,
      }));

      // --- Phase 2: Narration (streaming with thinking) ---
      setThinkingSteps([]); thinkingBufferRef.current = "";

      const narrationRes = await fetch("/api/simulation/after-effects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turn: simTurn,
          characters: resolvedCharacters,
          locations: locationInfos,
          gameHistory,
          influences: influenceObj,
          playerActions: playerActions.length > 0 ? playerActions : undefined,
          interactiveModule,
          seriesContext,
          arcContext,
          chapterMemory,
          scenarioContext,
        }),
      });

      if (!narrationRes.ok) {
        console.error("Narration phase failed:", await narrationRes.text());
        setIsProcessing(false);
        setThinkingSteps([]); thinkingBufferRef.current = "";
        return;
      }

      const narrationResult = await readSSEStream(narrationRes);
      setThinkingSteps([]); thinkingBufferRef.current = "";

      if (!narrationResult) {
        console.error("No result from narration stream");
        setIsProcessing(false);
        return;
      }

      const allActions: SimAction[] = narrationResult.actions;
      const worldNarration: string = narrationResult.worldNarration;

      // Append to game history
      const turnSummary = `**Turn ${nextTurn}:** ${worldNarration}`;
      setGameHistory((prev) => prev ? `${prev}\n\n${turnSummary}` : turnSummary);

      // Build character updates from resolved positions + narration moods
      const characterUpdates = simCharacters.map((c) => {
        const resolved = resolvedCharacters.find((r) => r.slug === c.characterSlug);
        const action = allActions.find((a) => a.characterSlug === c.characterSlug);

        return {
          ...c,
          locationSlug: resolved?.locationSlug ?? c.locationSlug,
          status: "idle" as const,
          mood: action?.mood ?? c.mood,
          lastAction: action?.actionDetail,
        };
      });

      const turnResult = { turn: nextTurn, actions: allActions, worldNarration };
      const pendingResult = {
        turn: nextTurn,
        characterUpdates: characterUpdates.map((c) => ({
          characterSlug: c.characterSlug,
          locationSlug: c.locationSlug,
          status: c.status,
          mood: c.mood,
          lastAction: c.lastAction,
        })),
        actions: allActions,
        worldNarration,
      };

      // Start playback
      setPlayback({
        current: { phase: "playing", actionIndex: 0 },
        turnResult,
        characterUpdates,
        pendingResult,
      });
    } catch (err) {
      console.error("Turn error:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [scenario, worldMap, simTurn, simCharacters, influences, seriesId, gameHistory, interactiveModule, seriesContext, arcContext, chapterMemory, scenarioContext, readSSEStream]);

  // Show the next player action modal, or proceed to AI phase if all collected
  const showNextPlayerAction = useCallback((roleplaySlugs: string[], index: number) => {
    if (!scenario || !worldMap) return;

    if (index >= roleplaySlugs.length) {
      // All player actions collected — run AI phase
      setPendingPlayerAction(null);
      const collected = new Map(playerActionsRef.current);
      runAIPhaseAndPlayback(collected);
      return;
    }

    const slug = roleplaySlugs[index];
    const sc = scenario.characters.find((c) => c.slug === slug);
    const state = simCharacters.find((c) => c.characterSlug === slug);
    const locationSlug = state?.locationSlug ?? sc?.startLocation ?? "";
    const currentLoc = worldMap.locations.find((l) => l.slug === locationSlug);

    const availableMoves = (currentLoc?.connections ?? []).map((conn) => {
      const loc = worldMap.locations.find((l) => l.slug === conn.target);
      return { slug: conn.target, name: loc?.name ?? conn.target, label: conn.label };
    });

    const nearbyCharacters = simCharacters
      .filter((c) => c.characterSlug !== slug && c.locationSlug === locationSlug)
      .map((c) => {
        const charSc = scenario.characters.find((s) => s.slug === c.characterSlug);
        return { slug: c.characterSlug, name: charSc?.name ?? c.characterSlug, mood: c.mood };
      });

    // Store which slugs remain so handlePlayerActionConfirm can advance
    pendingAIPhaseRef.current = () => showNextPlayerAction(roleplaySlugs, index + 1);

    setPendingPlayerAction({
      characterSlug: slug,
      characterName: sc?.name ?? slug,
      characterImage: `/series/${seriesId}/world/characters/${slug}.jpg`,
      locationSlug,
      availableMoves,
      nearbyCharacters,
    });
  }, [scenario, worldMap, simCharacters, seriesId, runAIPhaseAndPlayback]);

  // Handle player confirming their action
  const handlePlayerActionConfirm = useCallback((action: SimAction) => {
    playerActionsRef.current.set(action.characterSlug, action);
    // Advance to next roleplay character or AI phase
    if (pendingAIPhaseRef.current) {
      pendingAIPhaseRef.current();
    }
  }, []);

  // Cancel player action — abort the turn
  const handlePlayerActionCancel = useCallback(() => {
    setPendingPlayerAction(null);
    playerActionsRef.current.clear();
    pendingAIPhaseRef.current = null;
    setIsProcessing(false);
  }, []);

  // Advance turn — entry point
  const handleAdvanceTurn = useCallback(async () => {
    if (!scenario || !worldMap || isProcessing) return;

    setIsProcessing(true);
    setViewingTurn(null);

    // Check if any characters are roleplayed
    const roleplaySlugs = scenario.characters
      .filter((c) => roleplayCharacters.has(c.slug))
      .map((c) => c.slug);

    if (roleplaySlugs.length > 0) {
      // Enter player input phase — collect actions sequentially
      playerActionsRef.current.clear();
      showNextPlayerAction(roleplaySlugs, 0);
    } else {
      // No roleplay characters — go straight to AI phase
      runAIPhaseAndPlayback(new Map());
    }
  }, [scenario, worldMap, isProcessing, roleplayCharacters, showNextPlayerAction, runAIPhaseAndPlayback]);

  // Influence handlers
  const handleSetInfluence = useCallback((charSlug: string, text: string) => {
    setInfluences((prev) => {
      const next = new Map(prev);
      next.set(charSlug, text);
      return next;
    });
  }, []);

  const handleClearInfluence = useCallback((charSlug: string) => {
    setInfluences((prev) => {
      const next = new Map(prev);
      next.delete(charSlug);
      return next;
    });
  }, []);

  // Roleplay toggle
  const handleToggleRoleplay = useCallback((charSlug: string) => {
    setRoleplayCharacters((prev) => {
      const next = new Set(prev);
      if (next.has(charSlug)) {
        next.delete(charSlug);
      } else {
        next.add(charSlug);
      }
      return next;
    });
  }, []);

  // Commit turn result after playback finishes
  const commitTurnResult = useCallback(() => {
    if (!playback.pendingResult) return;
    const result = playback.pendingResult;

    setSimTurn(result.turn);
    setSimCharacters(playback.characterUpdates);
    charHistoryRef.current.set(result.turn, playback.characterUpdates);
    setSimTurnLog((prev) => [
      ...prev,
      {
        turn: result.turn,
        worldNarration: result.worldNarration,
        actions: result.actions as SimAction[],
      },
    ]);
    setPlayback({
      current: { phase: "idle" },
      turnResult: null,
      characterUpdates: [],
      pendingResult: null,
    });
  }, [playback]);

  // Advance playback to next action or commit
  const advancePlayback = useCallback(() => {
    if (playback.current.phase === "playing" && playback.turnResult) {
      const nextIndex = playback.current.actionIndex + 1;
      if (nextIndex < playback.turnResult.actions.length) {
        setPlayback((prev) => ({
          ...prev,
          current: { phase: "playing", actionIndex: nextIndex },
        }));
      } else {
        commitTurnResult();
      }
    }
  }, [playback, commitTurnResult]);

  // Compute progressive character positions during playback
  const playbackCharacters = (() => {
    if (playback.current.phase === "idle" || !playback.turnResult) return simCharacters;

    const actionIndex =
      playback.current.phase === "playing"
        ? playback.current.actionIndex
        : playback.turnResult.actions.length - 1;

    return simCharacters.map((c) => {
      const charActionIdx = playback.turnResult!.actions.findIndex(
        (a) => a.characterSlug === c.characterSlug,
      );
      if (charActionIdx >= 0 && charActionIdx <= actionIndex) {
        const updated = playback.characterUpdates.find(
          (u) => u.characterSlug === c.characterSlug,
        );
        return updated || c;
      }
      return c;
    });
  })();

  // Camera focus target during playback
  const focusLocation = (() => {
    if (playback.current.phase === "playing" && playback.turnResult) {
      const action = playback.turnResult.actions[playback.current.actionIndex];
      const charCurrentLoc = simCharacters.find(
        (c) => c.characterSlug === action?.characterSlug,
      )?.locationSlug;
      return action?.targetLocation || charCurrentLoc || null;
    }
    return null;
  })();

  // Highlighted character during playback
  const highlightCharacter =
    playback.current.phase === "playing" && playback.turnResult
      ? playback.turnResult.actions[playback.current.actionIndex]?.characterSlug ?? null
      : null;

  // Build character markers for the map — use historical positions when scrubbing
  const displayCharacters = viewingTurn !== null
    ? charHistoryRef.current.get(viewingTurn) ?? simCharacters
    : isPlaybackActive ? playbackCharacters : simCharacters;

  // Compute moving characters for animation (playback + history scrubbing)
  const [historyMoving, setHistoryMoving] = useState<{ slug: string; fromLocation: string; toLocation: string }[]>([]);

  // Detect character movements when scrubbing through turn history
  useEffect(() => {
    const prevTurn = prevViewingTurnRef.current;
    const currTurn = viewingTurn;
    prevViewingTurnRef.current = currTurn;

    // Only animate when actually changing viewed turns (not during playback)
    if (isPlaybackActive) {
      setHistoryMoving([]);
      return;
    }

    const prevChars = prevTurn !== null
      ? charHistoryRef.current.get(prevTurn)
      : (currTurn !== null ? simCharacters : null);
    const currChars = currTurn !== null
      ? charHistoryRef.current.get(currTurn)
      : simCharacters;

    if (!prevChars || !currChars || prevTurn === currTurn) {
      setHistoryMoving([]);
      return;
    }

    const moves: { slug: string; fromLocation: string; toLocation: string }[] = [];
    for (const curr of currChars) {
      const prev = prevChars.find((p) => p.characterSlug === curr.characterSlug);
      if (prev && prev.locationSlug !== curr.locationSlug) {
        moves.push({
          slug: curr.characterSlug,
          fromLocation: prev.locationSlug,
          toLocation: curr.locationSlug,
        });
      }
    }
    setHistoryMoving(moves);
  }, [viewingTurn, isPlaybackActive, simCharacters]);

  // Combine playback movement + history scrubbing movement
  const movingCharacters = (() => {
    if (playback.current.phase === "playing" && playback.turnResult) {
      const action = playback.turnResult.actions[playback.current.actionIndex];
      if (action?.actionType === "move" && action.targetLocation) {
        const fromLoc = simCharacters.find(
          (c) => c.characterSlug === action.characterSlug,
        )?.locationSlug;
        if (fromLoc && fromLoc !== action.targetLocation) {
          return [{
            slug: action.characterSlug,
            fromLocation: fromLoc,
            toLocation: action.targetLocation,
          }];
        }
      }
      return [];
    }
    return historyMoving;
  })();

  const charactersOnMap: CharacterOnMap[] = simActive
    ? displayCharacters.map((c) => {
        const sc = scenario?.characters.find((s) => s.slug === c.characterSlug);
        return {
          slug: c.characterSlug,
          name: sc?.name ?? c.characterSlug,
          locationSlug: c.locationSlug,
          image: `/series/${seriesId}/world/characters/${c.characterSlug}.jpg`,
          mood: c.mood,
          isPlayer: roleplayCharacters.has(c.characterSlug),
        };
      })
    : [];

  const scenarioCharacters = scenario?.characters.map((c) => ({
    slug: c.slug,
    name: c.name,
  })) ?? [];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!worldMap) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">No world map available for this series.</p>
          <Link href={`/${seriesId}`} className="text-violet-400 hover:text-violet-300 text-sm">
            ← Back to series
          </Link>
        </div>
      </div>
    );
  }

  const currentLocation =
    view.mode === "location"
      ? worldMap.locations.find((l) => l.slug === view.slug)
      : null;

  const connectedLocations = currentLocation
    ? worldMap.locations.filter((l) =>
        currentLocation.connections.some((c) => c.target === l.slug)
      )
    : [];

  return (
    <div className="fixed inset-0 bg-[#0a0a0f]">
      {/* Back to series (hidden during playback) */}
      {view.mode === "map" && !isPlaybackActive && (
        <Link
          href={`/${seriesId}`}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-slate-300 hover:text-white text-sm transition-all hover:bg-black/60"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Series</span>
        </Link>
      )}

      {/* Simulation launch button */}
      {view.mode === "map" && !simActive && (
        <div className="absolute bottom-6 left-6 z-20">
          <button
            onClick={handleStartSimulation}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 hover:text-white text-sm font-medium shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all duration-300"
          >
            <PlayIcon className="w-5 h-5" />
            Begin Simulation
          </button>
        </div>
      )}

      {/* Map view */}
      {view.mode === "map" && (
        <div className="absolute inset-0">
          <WorldMap
            seriesId={seriesId}
            clusters={worldMap.clusters || []}
            locations={worldMap.locations}
            defaultLocation={worldMap.defaultLocation}
            onSelectLocation={handleSelectLocation}
            characters={charactersOnMap}
            focusLocation={focusLocation}
            highlightCharacter={highlightCharacter}
            movingCharacters={movingCharacters}
          />
        </div>
      )}

      {/* Simulation bottom bar */}
      {view.mode === "map" && simActive && !isPlaybackActive && (
        <SimulationBottomBar
          seriesId={seriesId}
          turn={simTurn}
          status={simStatus}
          characters={displayCharacters}
          turnLog={simTurnLog}
          locations={worldMap.locations}
          scenarioCharacters={scenarioCharacters}
          isProcessing={isProcessing}
          influences={influences}
          onSetInfluence={handleSetInfluence}
          onClearInfluence={handleClearInfluence}
          onAdvanceTurn={handleAdvanceTurn}
          onPause={() => setSimStatus("paused")}
          onResume={() => setSimStatus("active")}
          viewingTurn={viewingTurn}
          onViewTurn={setViewingTurn}
          roleplayCharacters={roleplayCharacters}
          onToggleRoleplay={handleToggleRoleplay}
        />
      )}

      {/* Arc selection modal */}
      {showArcSelect && (
        <ArcSelectionModal
          arcs={arcList}
          onSelect={handleArcSelected}
          onCancel={() => setShowArcSelect(false)}
        />
      )}

      {/* Player action modal (roleplay) */}
      {pendingPlayerAction && (
        <PlayerActionModal
          characterSlug={pendingPlayerAction.characterSlug}
          characterName={pendingPlayerAction.characterName}
          characterImage={pendingPlayerAction.characterImage}
          locationSlug={pendingPlayerAction.locationSlug}
          locationName={worldMap.locations.find((l) => l.slug === pendingPlayerAction.locationSlug)?.name ?? pendingPlayerAction.locationSlug}
          availableMoves={pendingPlayerAction.availableMoves}
          nearbyCharacters={pendingPlayerAction.nearbyCharacters}
          onConfirm={handlePlayerActionConfirm}
          onCancel={handlePlayerActionCancel}
        />
      )}

      {/* Location view */}
      {view.mode === "location" && currentLocation && (
        <WorldLocation
          seriesId={seriesId}
          location={currentLocation}
          connectedLocations={connectedLocations}
          onBack={handleBackToMap}
          onNavigate={handleNavigate}
        />
      )}

      {/* Thinking toast — non-blocking bar above bottom HUD */}
      {isProcessing && (
        <div className="absolute bottom-14 inset-x-0 z-30 flex justify-center pointer-events-none">
          <div className="max-w-lg w-full mx-4 bg-[#0f0f18]/95 backdrop-blur-md border border-violet-500/15 rounded-xl px-4 py-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse shrink-0" />
              <div className="flex-1 min-w-0">
                {thinkingSteps.length > 0 ? (
                  <p className="text-xs text-slate-300 leading-relaxed truncate">
                    {thinkingSteps[thinkingSteps.length - 1]}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">Resolving turn...</p>
                )}
              </div>
              {thinkingSteps.length > 0 && (
                <span className="text-[9px] text-slate-600 tabular-nums shrink-0">
                  {thinkingSteps.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Turn playback: VN-style bottom dialogue box */}
      {playback.current.phase === "playing" && playback.turnResult && (() => {
        const action = playback.turnResult.actions[playback.current.actionIndex];
        const sc = scenario?.characters.find((c) => c.slug === action.characterSlug);
        const charState = simCharacters.find((c) => c.characterSlug === action.characterSlug);
        const locName = worldMap.locations.find((l) => l.slug === charState?.locationSlug)?.name ?? charState?.locationSlug ?? "Unknown";
        const targetLocName = action.targetLocation
          ? worldMap.locations.find((l) => l.slug === action.targetLocation)?.name
          : undefined;
        const targetCharSc = action.targetCharacter
          ? scenario?.characters.find((c) => c.slug === action.targetCharacter)
          : undefined;
        return (
          <TurnPlaybackBox
            action={action}
            characterName={sc?.name ?? action.characterSlug}
            characterImage={`/series/${seriesId}/world/characters/${action.characterSlug}.jpg`}
            characterLocation={locName}
            targetLocationName={targetLocName}
            targetCharacterName={targetCharSc?.name}
            targetCharacterImage={action.targetCharacter ? `/series/${seriesId}/world/characters/${action.targetCharacter}.jpg` : undefined}
            turnNumber={playback.turnResult.turn}
            actionIndex={playback.current.actionIndex}
            totalActions={playback.turnResult.actions.length}
            onAdvance={advancePlayback}
          />
        );
      })()}
    </div>
  );
}

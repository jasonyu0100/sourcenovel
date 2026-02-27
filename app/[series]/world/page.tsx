"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import type { WorldMapData } from "@/lib/world-types";
import type { ScenarioData, SimCharacterState, SimTurnResult, SimAction, PlaybackState, EncounterType } from "@/lib/simulation-types";
import { loadWorldMap, loadScenario, loadCharacterProfile } from "@/lib/world-data";
import { WorldMap } from "@/components/world-map";
import type { CharacterOnMap } from "@/components/world-map";
import { WorldLocation } from "@/components/world-location";
import { SimulationBottomBar } from "@/components/simulation-bottom-bar";
import { TurnPlaybackBox } from "@/components/turn-playback-box";
import { EncounterPlaybackBox } from "@/components/encounter-playback-box";
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
  const encounterQueueRef = useRef<{ locationSlug: string; characterSlugs: string[]; encounterType: EncounterType; secondLocationSlug?: string }[]>([]);
  const [encounterConversation, setEncounterConversation] = useState<
    { speaker: string; speakerSlug: string; line: string; type: "dialogue" | "action" | "thought" }[] | null
  >(null);
  const [encounterLoading, setEncounterLoading] = useState(false);
  const isPlaybackActive = playback.current.phase !== "idle";

  useEffect(() => {
    async function load() {
      const map = await loadWorldMap(seriesId);
      if (map) setWorldMap(map);
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

  // Start simulation (god-mode only — no player character)
  const handleStartSimulation = useCallback(async () => {
    const sc = await loadScenario(seriesId, "tensions-rising");
    if (!sc || !worldMap) return;

    // Load character profiles
    for (const char of sc.characters) {
      const profile = await loadCharacterProfile(seriesId, char.profile);
      if (profile) characterProfilesRef.current.set(char.slug, profile);
    }

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
    setViewingTurn(null);
    charHistoryRef.current = new Map();
    charHistoryRef.current.set(0, initialChars);
    setSimActive(true);
  }, [seriesId, worldMap]);

  // Run AI phase + narration + playback (called after all player actions are collected)
  const runAIPhaseAndPlayback = useCallback(async (collectedPlayerActions: Map<string, SimAction>) => {
    if (!scenario || !worldMap) return;

    try {
      const nextTurn = simTurn + 1;

      const characterContexts = scenario.characters.map((sc) => {
        const state = simCharacters.find(
          (c) => c.characterSlug === sc.slug,
        );
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

      const recentTurns = simTurnLog.slice(-5).map((t) => ({
        turn: t.turn,
        worldNarration: t.worldNarration,
      }));

      // Resolve AI characters in parallel, use collected actions for player characters
      const characterPromises = characterContexts.map(async (char) => {
        // If this character has a player-submitted action, use it directly
        const playerAction = collectedPlayerActions.get(char.slug);
        if (playerAction) return playerAction;

        const influence = influences.get(char.slug);
        const res = await fetch("/api/simulation/character-turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seriesId,
            turn: simTurn,
            character: char,
            allCharacters: characterContexts,
            locations: locationInfos,
            recentTurns,
            influence: influence || undefined,
          }),
        });

        if (!res.ok) {
          console.error(`Character turn failed for ${char.slug}:`, await res.text());
          return {
            characterSlug: char.slug,
            actionType: "wait" as const,
            actionDetail: "wait",
            narration: `${char.name} remains where they are, observing.`,
            mood: char.mood,
          };
        }

        return res.json();
      });

      const allActions: SimAction[] = await Promise.all(characterPromises);

      // Synthesize world narration
      const narrateRes = await fetch("/api/simulation/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId,
          turn: nextTurn,
          actions: allActions.map((a) => ({
            characterSlug: a.characterSlug,
            characterName: scenario.characters.find((sc) => sc.slug === a.characterSlug)?.name ?? a.characterSlug,
            actionType: a.actionType,
            narration: a.narration,
            dialogue: a.dialogue,
            targetLocation: a.targetLocation,
            targetCharacter: a.targetCharacter,
            mood: a.mood,
          })),
          recentTurns,
        }),
      });

      let worldNarration = "The Terrace turns quietly.";

      if (narrateRes.ok) {
        const narrateResult = await narrateRes.json();
        worldNarration = narrateResult.worldNarration;
      }

      // Build character updates (apply movement)
      const characterUpdates = simCharacters.map((c) => {
        const action = allActions.find((a) => a.characterSlug === c.characterSlug);
        const newLocation =
          action?.actionType === "move" && action.targetLocation
            ? action.targetLocation
            : c.locationSlug;

        return {
          ...c,
          locationSlug: newLocation,
          status: "idle" as const,
          mood: action?.mood ?? c.mood,
          lastAction: action?.actionDetail,
        };
      });

      // Start sequential playback
      setPlayback({
        current: { phase: "playing", actionIndex: 0 },
        turnResult: {
          turn: nextTurn,
          actions: allActions,
          worldNarration,
        },
        characterUpdates,
        pendingResult: {
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
        },
      });
    } catch (err) {
      console.error("Turn error:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [scenario, worldMap, simTurn, simCharacters, simTurnLog, influences, seriesId]);

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

  // Generate encounter conversation via API
  const generateEncounterConversation = useCallback(async (locationSlug: string, characterSlugs: string[], encounterType: EncounterType = "convergence", secondLocationSlug?: string) => {
    if (!scenario || !worldMap || !playback.turnResult) return;

    setEncounterConversation(null);
    setEncounterLoading(true);

    try {
      const loc = worldMap.locations.find((l) => l.slug === locationSlug);
      const secondLoc = secondLocationSlug ? worldMap.locations.find((l) => l.slug === secondLocationSlug) : null;
      const encounterChars = characterSlugs.map((slug) => {
        const sc = scenario.characters.find((c) => c.slug === slug);
        return {
          slug,
          name: sc?.name ?? slug,
          profile: characterProfilesRef.current.get(slug) ?? sc?.personality ?? "",
          personality: sc?.personality ?? "",
          faction: sc?.faction ?? null,
          mood: playback.characterUpdates.find((c) => c.characterSlug === slug)?.mood ?? "neutral",
          goals: sc?.goals ?? [],
          lastAction: playback.characterUpdates.find((c) => c.characterSlug === slug)?.lastAction,
        };
      });

      const encounterActions = playback.turnResult.actions
        .filter((a) => characterSlugs.includes(a.characterSlug))
        .map((a) => ({
          characterSlug: a.characterSlug,
          narration: a.narration,
          dialogue: a.dialogue,
          actionType: a.actionType,
        }));

      let locationName = loc?.name ?? locationSlug;
      let locationDescription = loc?.description ?? "";
      if (encounterType === "crossover" && secondLoc) {
        locationName = `between ${loc?.name ?? locationSlug} and ${secondLoc.name}`;
        locationDescription = `A crossing point on the path between ${loc?.name ?? locationSlug} (${loc?.description ?? ""}) and ${secondLoc.name} (${secondLoc.description})`;
      } else if (encounterType === "near-miss") {
        locationName = loc?.name ?? locationSlug;
        locationDescription = `${loc?.description ?? ""} — one character has just arrived as the other departs`;
      }

      const res = await fetch("/api/simulation/encounter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId,
          turn: playback.turnResult.turn,
          locationName,
          locationDescription,
          encounterType,
          characters: encounterChars,
          actions: encounterActions,
          recentTurns: simTurnLog.slice(-3).map((t) => ({
            turn: t.turn,
            worldNarration: t.worldNarration,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setEncounterConversation(data.conversation);
      }
    } catch (err) {
      console.error("Encounter generation error:", err);
    } finally {
      setEncounterLoading(false);
    }
  }, [scenario, worldMap, playback.turnResult, playback.characterUpdates, seriesId, simTurnLog]);

  // Advance playback to next character or encounter
  const advancePlayback = useCallback(() => {
    if (playback.current.phase === "playing" && playback.turnResult) {
      const nextIndex = playback.current.actionIndex + 1;
      const totalActions = playback.turnResult.actions.length;

      if (nextIndex < totalActions) {
        setPlayback((prev) => ({
          ...prev,
          current: { phase: "playing", actionIndex: nextIndex },
        }));
      } else {
        // Detect all encounter types
        const allEncounters: { locationSlug: string; characterSlugs: string[]; encounterType: EncounterType; secondLocationSlug?: string }[] = [];
        const encounteredPairs = new Set<string>(); // avoid duplicating char pairs

        // 1. Convergence: multiple characters end at the same location
        const locationGroups = new Map<string, string[]>();
        for (const char of playback.characterUpdates) {
          const list = locationGroups.get(char.locationSlug) || [];
          list.push(char.characterSlug);
          locationGroups.set(char.locationSlug, list);
        }
        Array.from(locationGroups.entries()).forEach(([locSlug, slugs]) => {
          if (slugs.length > 1) {
            allEncounters.push({ locationSlug: locSlug, characterSlugs: slugs, encounterType: "convergence" });
            for (let si = 0; si < slugs.length; si++) {
              for (let sj = si + 1; sj < slugs.length; sj++) {
                encounteredPairs.add([slugs[si], slugs[sj]].sort().join(":"));
              }
            }
          }
        });

        // Build movement map: slug -> { from, to }
        const movements = new Map<string, { from: string; to: string }>();
        for (const action of playback.turnResult.actions) {
          if (action.actionType === "move" && action.targetLocation) {
            const prevLoc = simCharacters.find((c) => c.characterSlug === action.characterSlug)?.locationSlug;
            if (prevLoc && prevLoc !== action.targetLocation) {
              movements.set(action.characterSlug, { from: prevLoc, to: action.targetLocation });
            }
          }
        }

        const movingChars = Array.from(movements.entries());

        // 2. Crossover: A moves X→Y, B moves Y→X (they swap and pass each other)
        for (let i = 0; i < movingChars.length; i++) {
          for (let j = i + 1; j < movingChars.length; j++) {
            const [slugA, moveA] = movingChars[i];
            const [slugB, moveB] = movingChars[j];
            const pairKey = [slugA, slugB].sort().join(":");
            if (encounteredPairs.has(pairKey)) continue;

            if (moveA.from === moveB.to && moveA.to === moveB.from) {
              // Full swap — they crossed on the same edge
              allEncounters.push({
                locationSlug: moveA.from,
                secondLocationSlug: moveA.to,
                characterSlugs: [slugA, slugB],
                encounterType: "crossover",
              });
              encounteredPairs.add(pairKey);
            }
          }
        }

        // 3. Near-miss: A arrives at Y, B was at Y and left this turn
        for (const [slugA, moveA] of movingChars) {
          for (const [slugB, moveB] of movingChars) {
            if (slugA === slugB) continue;
            const pairKey = [slugA, slugB].sort().join(":");
            if (encounteredPairs.has(pairKey)) continue;

            // A arrives at location that B just left
            if (moveA.to === moveB.from) {
              allEncounters.push({
                locationSlug: moveA.to,
                characterSlugs: [slugA, slugB],
                encounterType: "near-miss",
              });
              encounteredPairs.add(pairKey);
            }
          }
        }

        if (allEncounters.length > 0) {
          encounterQueueRef.current = allEncounters.slice(1);
          const first = allEncounters[0];
          setPlayback((prev) => ({
            ...prev,
            current: {
              phase: "encounter",
              locationSlug: first.locationSlug,
              characterSlugs: first.characterSlugs,
              encounterType: first.encounterType,
              secondLocationSlug: first.secondLocationSlug,
            },
          }));
          generateEncounterConversation(first.locationSlug, first.characterSlugs, first.encounterType, first.secondLocationSlug);
        } else {
          commitTurnResult();
        }
      }
    } else if (playback.current.phase === "encounter") {
      const remaining = encounterQueueRef.current;
      if (remaining.length > 0) {
        const next = remaining.shift()!;
        setPlayback((prev) => ({
          ...prev,
          current: {
            phase: "encounter",
            locationSlug: next.locationSlug,
            characterSlugs: next.characterSlugs,
            encounterType: next.encounterType,
            secondLocationSlug: next.secondLocationSlug,
          },
        }));
        generateEncounterConversation(next.locationSlug, next.characterSlugs, next.encounterType, next.secondLocationSlug);
      } else {
        setEncounterConversation(null);
        commitTurnResult();
      }
    }
  }, [playback, commitTurnResult]);

  // Compute progressive character positions during playback
  // Characters update to their new position once their action index is reached.
  // The map handles the visual animation via movingCharacters — static positions
  // should always reflect the destination so characters land correctly.
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
  // For move actions, focus on the destination so the camera pans alongside the character
  const focusLocation = (() => {
    if (playback.current.phase === "playing" && playback.turnResult) {
      const action = playback.turnResult.actions[playback.current.actionIndex];
      const charCurrentLoc = simCharacters.find(
        (c) => c.characterSlug === action?.characterSlug,
      )?.locationSlug;
      // For moves: focus on destination (camera and character animate together)
      // For non-moves: focus on character's current location
      return action?.targetLocation || charCurrentLoc || null;
    }
    if (playback.current.phase === "encounter") {
      return playback.current.locationSlug;
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
      : (currTurn !== null ? simCharacters : null); // going from present to history
    const currChars = currTurn !== null
      ? charHistoryRef.current.get(currTurn)
      : simCharacters; // going back to present

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
    // During playback: single character moving
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
    // During history scrubbing: multiple characters may move
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
      {/* Back to series (hidden during playback — legend occupies top-left) */}
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
            className="px-4 py-2 rounded-full bg-violet-600/80 backdrop-blur-sm border border-violet-400/20 text-white text-sm hover:bg-violet-500/80 transition-all"
          >
            Begin Simulation
          </button>
        </div>
      )}

      {/* Map view — full width now (no sidebar) */}
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

      {/* Encounter playback box */}
      {playback.current.phase === "encounter" && playback.turnResult && (() => {
        const locSlug = playback.current.locationSlug;
        const loc = worldMap.locations.find((l) => l.slug === locSlug);
        const secondLocSlug = playback.current.phase === "encounter" ? playback.current.secondLocationSlug : undefined;
        const secondLoc = secondLocSlug
          ? worldMap.locations.find((l) => l.slug === secondLocSlug)
          : null;
        const charSlugs = playback.current.characterSlugs;
        const eType = playback.current.encounterType;
        const displayLocationName = eType === "crossover" && secondLoc
          ? `${loc?.name ?? locSlug} ↔ ${secondLoc.name}`
          : loc?.name ?? locSlug;
        return (
          <EncounterPlaybackBox
            locationName={displayLocationName}
            encounterType={eType}
            characters={charSlugs.map((slug) => {
              const sc = scenario?.characters.find((c) => c.slug === slug);
              const state = playback.characterUpdates.find((c) => c.characterSlug === slug);
              return {
                slug,
                name: sc?.name ?? slug,
                image: `/series/${seriesId}/world/characters/${slug}.jpg`,
                mood: state?.mood ?? "neutral",
              };
            })}
            actions={playback.turnResult.actions.filter((a) =>
              charSlugs.includes(a.characterSlug),
            )}
            conversation={encounterConversation}
            conversationLoading={encounterLoading}
            onAdvance={advancePlayback}
          />
        );
      })()}
    </div>
  );
}

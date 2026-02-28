"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, PlayIcon } from "@heroicons/react/24/outline";
import type { WorldMapData } from "@/lib/world-types";
import type { ScenarioData, SimCharacterState, SimTurnResult, SimAction, PlaybackState, PreGeneratedEncounter } from "@/lib/simulation-types";
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

  // Relationship scores: "charA:charB" (sorted) -> score (-100 to 100)
  const [relationships, setRelationships] = useState<{ [pairKey: string]: number }>({});

  // Turn playback state machine
  const [playback, setPlayback] = useState<PlaybackState>({
    current: { phase: "idle" },
    turnResult: null,
    characterUpdates: [],
    encounters: [],
    relationshipDeltas: [],
    pendingResult: null,
  });
  const isPlaybackActive = playback.current.phase !== "idle";

  // Helper: make a deterministic pair key
  const pairKey = (a: string, b: string) => [a, b].sort().join(":");

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

      // --- Detect all encounters immediately ---
      const allEncounters: PreGeneratedEncounter[] = [];
      const encounteredPairs = new Set<string>();

      // 1. Convergence: multiple characters end at the same location
      const locationGroups = new Map<string, string[]>();
      for (const char of characterUpdates) {
        const list = locationGroups.get(char.locationSlug) || [];
        list.push(char.characterSlug);
        locationGroups.set(char.locationSlug, list);
      }
      for (const [locSlug, slugs] of Array.from(locationGroups.entries())) {
        if (slugs.length > 1) {
          allEncounters.push({ locationSlug: locSlug, characterSlugs: slugs, encounterType: "convergence", conversation: null, loading: true });
          for (let si = 0; si < slugs.length; si++) {
            for (let sj = si + 1; sj < slugs.length; sj++) {
              encounteredPairs.add(pairKey(slugs[si], slugs[sj]));
            }
          }
        }
      }

      // Build movement map
      const movements = new Map<string, { from: string; to: string }>();
      for (const action of allActions) {
        if (action.actionType === "move" && action.targetLocation) {
          const prevLoc = simCharacters.find((c) => c.characterSlug === action.characterSlug)?.locationSlug;
          if (prevLoc && prevLoc !== action.targetLocation) {
            movements.set(action.characterSlug, { from: prevLoc, to: action.targetLocation });
          }
        }
      }
      const movingChars = Array.from(movements.entries());

      // 2. Crossover
      for (let i = 0; i < movingChars.length; i++) {
        for (let j = i + 1; j < movingChars.length; j++) {
          const [slugA, moveA] = movingChars[i];
          const [slugB, moveB] = movingChars[j];
          const pk = pairKey(slugA, slugB);
          if (encounteredPairs.has(pk)) continue;
          if (moveA.from === moveB.to && moveA.to === moveB.from) {
            allEncounters.push({ locationSlug: moveA.from, secondLocationSlug: moveA.to, characterSlugs: [slugA, slugB], encounterType: "crossover", conversation: null, loading: true });
            encounteredPairs.add(pk);
          }
        }
      }

      // 3. Near-miss
      for (const [slugA, moveA] of movingChars) {
        for (const [slugB, moveB] of movingChars) {
          if (slugA === slugB) continue;
          const pk = pairKey(slugA, slugB);
          if (encounteredPairs.has(pk)) continue;
          if (moveA.to === moveB.from) {
            allEncounters.push({ locationSlug: moveA.to, characterSlugs: [slugA, slugB], encounterType: "near-miss", conversation: null, loading: true });
            encounteredPairs.add(pk);
          }
        }
      }

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

      // Start playback immediately — encounters generate in background
      setPlayback({
        current: { phase: "playing", actionIndex: 0 },
        turnResult,
        characterUpdates,
        encounters: allEncounters,
        relationshipDeltas: [],
        pendingResult,
      });

      // --- Fire all encounter generations in parallel (background) ---
      if (allEncounters.length > 0) {
        const encounterPromises = allEncounters.map(async (enc, idx) => {
          try {
            const loc = worldMap.locations.find((l) => l.slug === enc.locationSlug);
            const secondLoc = enc.secondLocationSlug ? worldMap.locations.find((l) => l.slug === enc.secondLocationSlug) : null;
            const encounterChars = enc.characterSlugs.map((slug) => {
              const sc = scenario.characters.find((c) => c.slug === slug);
              return {
                slug,
                name: sc?.name ?? slug,
                profile: characterProfilesRef.current.get(slug) ?? sc?.personality ?? "",
                personality: sc?.personality ?? "",
                faction: sc?.faction ?? null,
                mood: characterUpdates.find((c) => c.characterSlug === slug)?.mood ?? "neutral",
                goals: sc?.goals ?? [],
                lastAction: characterUpdates.find((c) => c.characterSlug === slug)?.lastAction,
              };
            });

            const encounterActions = allActions
              .filter((a) => enc.characterSlugs.includes(a.characterSlug))
              .map((a) => ({ characterSlug: a.characterSlug, narration: a.narration, dialogue: a.dialogue, actionType: a.actionType }));

            let locationName = loc?.name ?? enc.locationSlug;
            let locationDescription = loc?.description ?? "";
            if (enc.encounterType === "crossover" && secondLoc) {
              locationName = `between ${loc?.name ?? enc.locationSlug} and ${secondLoc.name}`;
              locationDescription = `A crossing point between ${loc?.name} (${loc?.description ?? ""}) and ${secondLoc.name} (${secondLoc.description})`;
            } else if (enc.encounterType === "near-miss") {
              locationDescription = `${loc?.description ?? ""} — one character has just arrived as the other departs`;
            }

            const res = await fetch("/api/simulation/encounter", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                seriesId,
                turn: nextTurn,
                locationName,
                locationDescription,
                encounterType: enc.encounterType,
                characters: encounterChars,
                actions: encounterActions,
                recentTurns: simTurnLog.slice(-3).map((t) => ({ turn: t.turn, worldNarration: t.worldNarration })),
                relationships,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              return { idx, conversation: data.conversation };
            }
          } catch (err) {
            console.error(`Encounter ${idx} generation error:`, err);
          }
          return { idx, conversation: [] };
        });

        // As each encounter resolves, update playback state
        for (const promise of encounterPromises) {
          promise.then(({ idx, conversation }) => {
            setPlayback((prev) => {
              const updated = [...prev.encounters];
              updated[idx] = { ...updated[idx], conversation, loading: false };
              return { ...prev, encounters: updated };
            });
          });
        }

        // After ALL encounters resolve, fire after-effects
        Promise.all(encounterPromises).then(async (results) => {
          const completedEncounters = allEncounters.map((enc, i) => ({
            encounterType: enc.encounterType,
            characterSlugs: enc.characterSlugs,
            characterNames: enc.characterSlugs.map((s) => scenario.characters.find((c) => c.slug === s)?.name ?? s),
            conversation: results[i]?.conversation ?? null,
          }));

          try {
            const res = await fetch("/api/simulation/after-effects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ encounters: completedEncounters, currentRelationships: relationships }),
            });
            if (res.ok) {
              const { deltas } = await res.json();
              setPlayback((prev) => ({ ...prev, relationshipDeltas: deltas }));
            }
          } catch (err) {
            console.error("After-effects error:", err);
          }
        });
      }
    } catch (err) {
      console.error("Turn error:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [scenario, worldMap, simTurn, simCharacters, simTurnLog, influences, seriesId, relationships, pairKey]);

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

  // Commit turn result after playback finishes (including applying relationship deltas)
  const commitTurnResult = useCallback(() => {
    if (!playback.pendingResult) return;
    const result = playback.pendingResult;

    // Apply relationship deltas
    if (playback.relationshipDeltas.length > 0) {
      setRelationships((prev) => {
        const next = { ...prev };
        for (const delta of playback.relationshipDeltas) {
          const key = pairKey(delta.characterA, delta.characterB);
          const current = next[key] ?? 0;
          next[key] = Math.max(-100, Math.min(100, current + delta.delta));
        }
        return next;
      });
    }

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
      encounters: [],
      relationshipDeltas: [],
      pendingResult: null,
    });
  }, [playback, pairKey]);

  // Advance playback to next action, encounter, after-effects, or commit
  const advancePlayback = useCallback(() => {
    if (playback.current.phase === "playing" && playback.turnResult) {
      const nextIndex = playback.current.actionIndex + 1;
      if (nextIndex < playback.turnResult.actions.length) {
        setPlayback((prev) => ({
          ...prev,
          current: { phase: "playing", actionIndex: nextIndex },
        }));
      } else if (playback.encounters.length > 0) {
        // Move to first pre-generated encounter
        setPlayback((prev) => ({
          ...prev,
          current: { phase: "encounter", encounterIndex: 0 },
        }));
      } else {
        commitTurnResult();
      }
    } else if (playback.current.phase === "encounter") {
      const nextIdx = playback.current.encounterIndex + 1;
      if (nextIdx < playback.encounters.length) {
        setPlayback((prev) => ({
          ...prev,
          current: { phase: "encounter", encounterIndex: nextIdx },
        }));
      } else if (playback.relationshipDeltas.length > 0) {
        // Show after-effects phase
        setPlayback((prev) => ({
          ...prev,
          current: { phase: "after-effects" },
        }));
      } else {
        commitTurnResult();
      }
    } else if (playback.current.phase === "after-effects") {
      commitTurnResult();
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
      const enc = playback.encounters[playback.current.encounterIndex];
      return enc?.locationSlug ?? null;
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
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 hover:text-white text-sm font-medium shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all duration-300"
          >
            <PlayIcon className="w-5 h-5" />
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
          relationships={relationships}
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
        const enc = playback.encounters[playback.current.encounterIndex];
        if (!enc) return null;
        const loc = worldMap.locations.find((l) => l.slug === enc.locationSlug);
        const secondLoc = enc.secondLocationSlug
          ? worldMap.locations.find((l) => l.slug === enc.secondLocationSlug)
          : null;
        const displayLocationName = enc.encounterType === "crossover" && secondLoc
          ? `${loc?.name ?? enc.locationSlug} ↔ ${secondLoc.name}`
          : loc?.name ?? enc.locationSlug;
        return (
          <EncounterPlaybackBox
            locationName={displayLocationName}
            encounterType={enc.encounterType}
            characters={enc.characterSlugs.map((slug: string) => {
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
              enc.characterSlugs.includes(a.characterSlug),
            )}
            conversation={enc.conversation}
            conversationLoading={enc.loading}
            onAdvance={advancePlayback}
          />
        );
      })()}

      {/* After-effects phase: relationship changes */}
      {playback.current.phase === "after-effects" && playback.relationshipDeltas.length > 0 && (
        <div
          className="fixed bottom-14 inset-x-0 z-40 flex justify-center pointer-events-none"
        >
          <div
            className="bg-[#0f0f18]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-fade-in pointer-events-auto"
            onClick={advancePlayback}
          >
            <div className="flex items-start gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] uppercase tracking-widest text-violet-400">After Effects</span>
                  <span className="text-sm font-semibold text-white">Relationship Changes</span>
                </div>

                <div className="space-y-1.5">
                  {playback.relationshipDeltas.map((delta, i) => {
                    const nameA = scenario?.characters.find((c) => c.slug === delta.characterA)?.name ?? delta.characterA;
                    const nameB = scenario?.characters.find((c) => c.slug === delta.characterB)?.name ?? delta.characterB;
                    const isPositive = delta.delta > 0;
                    return (
                      <div key={i} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-white/[0.02]">
                        <span className="text-slate-300">{nameA} ↔ {nameB}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{delta.reason}</span>
                          <span className={`font-medium ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                            {isPositive ? "+" : ""}{delta.delta}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); advancePlayback(); }}
                className="px-3 py-1 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 mt-1"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

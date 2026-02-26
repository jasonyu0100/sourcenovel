"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftIcon, XMarkIcon, MapPinIcon, MusicalNoteIcon, BoltIcon } from "@heroicons/react/24/outline";
import { SignedIn } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { StoryContext } from "@/lib/episode-context";
import { locationToImageSrc, characterToImageSrc } from "@/lib/episode-context";
import { useWorldMarkdown } from "@/lib/use-world-description";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface StoryBeat {
  narration: string;
  speaker: string | null;
  dialogue: string | null;
  location: string | null;
  choices: string[];
}

interface EpisodeInteractiveProps {
  storyContext: StoryContext;
  playAsCharacter?: string | null;
  sessionMode?: "illustrated" | "dialogue";
  interactiveModule?: string | null;
  bgmPlaying?: boolean;
  onToggleBgm?: () => void;
  onClose: () => void;
  onBackToEpisodes?: () => void;
  replaySessionId?: string | null;
}

/** Extract a string field value from partial/streaming JSON. Handles escape sequences. */
function extractPartialField(buffer: string, fieldName: string): string | null {
  const pattern = new RegExp(`"${fieldName}"\\s*:\\s*"`);
  const match = buffer.match(pattern);
  if (!match || match.index === undefined) return null;

  const startIdx = match.index + match[0].length;
  let result = "";
  let i = startIdx;

  while (i < buffer.length) {
    if (buffer[i] === "\\" && i + 1 < buffer.length) {
      const next = buffer[i + 1];
      if (next === '"') result += '"';
      else if (next === "n") result += "\n";
      else if (next === "\\") result += "\\";
      else if (next === "t") result += "\t";
      else result += next;
      i += 2;
    } else if (buffer[i] === '"') {
      break; // end of string value
    } else {
      result += buffer[i];
      i++;
    }
  }

  return result;
}

/** Check if a string field is fully closed (has closing quote). */
function isFieldComplete(buffer: string, fieldName: string): boolean {
  const pattern = new RegExp(`"${fieldName}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s");
  return pattern.test(buffer);
}

/** Extract a complete JSON value for null-able fields (returns "null" or the string value). */
function extractNullableField(buffer: string, fieldName: string): string | null {
  const nullPattern = new RegExp(`"${fieldName}"\\s*:\\s*null`);
  if (nullPattern.test(buffer)) return null;
  if (!isFieldComplete(buffer, fieldName)) return null;
  return extractPartialField(buffer, fieldName);
}

/** Parse complete JSON from raw buffer, handling fences and sanitization. */
function extractJSON(text: string): Record<string, unknown> | null {
  const sanitized = text.replace(/\\'/g, "'");
  try { return JSON.parse(sanitized); } catch { /* continue */ }
  const fenceMatch = sanitized.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1]); } catch { /* continue */ } }
  const start = sanitized.indexOf("{");
  const end = sanitized.lastIndexOf("}");
  if (start !== -1 && end > start) { try { return JSON.parse(sanitized.slice(start, end + 1)); } catch { /* continue */ } }
  return null;
}

// Rotating color palette for speakers — assigned by order of appearance
const SPEAKER_PALETTE = [
  { text: "text-violet-300", border: "border-violet-500/40", bg: "bg-violet-500/10", ring: "ring-violet-500/30" },
  { text: "text-sky-300", border: "border-sky-500/40", bg: "bg-sky-500/10", ring: "ring-sky-500/30" },
  { text: "text-amber-300", border: "border-amber-500/40", bg: "bg-amber-500/10", ring: "ring-amber-500/30" },
  { text: "text-emerald-300", border: "border-emerald-500/40", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" },
  { text: "text-rose-300", border: "border-rose-500/40", bg: "bg-rose-500/10", ring: "ring-rose-500/30" },
  { text: "text-cyan-300", border: "border-cyan-500/40", bg: "bg-cyan-500/10", ring: "ring-cyan-500/30" },
];

const speakerColorMap = new Map<string, typeof SPEAKER_PALETTE[0]>();

function getSpeakerStyle(name: string) {
  if (!speakerColorMap.has(name)) {
    speakerColorMap.set(name, SPEAKER_PALETTE[speakerColorMap.size % SPEAKER_PALETTE.length]);
  }
  return speakerColorMap.get(name)!;
}

function TokenBadge() {
  const tokens = useQuery(api.users.getTokenBalance);
  if (tokens === null || tokens === undefined) return null;
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/30 backdrop-blur-sm">
      <BoltIcon className="w-3.5 h-3.5 text-violet-400" />
      <span className="text-xs text-white/70">
        <span className="font-semibold text-white">{tokens}</span>
      </span>
    </div>
  );
}

export function EpisodeInteractive({ storyContext, playAsCharacter, sessionMode = "illustrated", interactiveModule, bgmPlaying, onToggleBgm, onClose, onBackToEpisodes, replaySessionId }: EpisodeInteractiveProps) {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [storyBeats, setStoryBeats] = useState<StoryBeat[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(
    storyContext.currentLocation || storyContext.episodeData?.startingLocation || null
  );
  const [currentCharacters, setCurrentCharacters] = useState(storyContext.currentCharacters);

  // Typewriter state - single counter for both narration + dialogue
  const [revealedChars, setRevealedChars] = useState(0);
  const progressRef = useRef(0);
  const beatCountRef = useRef(0);

  // Streaming state
  const [streaming, setStreaming] = useState(false);
  const skipModeRef = useRef(false);
  const rawBufferRef = useRef("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Panel generation state
  const [panelUrls, setPanelUrls] = useState<(string | null)[]>([]);
  const [panelRefs, setPanelRefs] = useState<{ label: string; url: string }[][]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelElapsed, setPanelElapsed] = useState(0);
  const previousPanelUrlRef = useRef<string | null>(null);

  // Session persistence state
  const sessionIdRef = useRef<Id<"sessions"> | null>(null);
  const sessionReadyRef = useRef<Promise<Id<"sessions"> | null>>(Promise.resolve(null));
  const sessionCreatedRef = useRef(false);
  const createSession = useMutation(api.sessions.createSession);
  const addBeatMutation = useMutation(api.sessions.addBeat);
  const storePanelImage = useMutation(api.sessions.storePanelImage);
  const generateUploadUrl = useMutation(api.sessions.generateUploadUrl);
  const lastUserChoiceRef = useRef<string>("Begin the scene");

  // Replay mode
  const isReplay = !!replaySessionId;
  const replayBeats = useQuery(
    api.sessions.getSessionBeats,
    replaySessionId ? { sessionId: replaySessionId as Id<"sessions"> } : "skip"
  );
  const [replayIndex, setReplayIndex] = useState(0);

  // Scroll ref for text panel
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";

    // Create session on mount (not in replay mode)
    // Guard against React StrictMode double-mount
    if (!isReplay && !sessionCreatedRef.current) {
      sessionCreatedRef.current = true;
      const sessionPromise = createSession({
        seriesId: storyContext.seriesId,
        chapterNum: storyContext.chapterNum,
        characterName: playAsCharacter || storyContext.povCharacter,
        mode: sessionMode,
        startBeatIndex: storyContext.beatIndex,
      }).then(id => {
        sessionIdRef.current = id;
        return id;
      }).catch(() => null);
      sessionReadyRef.current = sessionPromise;
    }

    return () => {
      document.body.style.overflow = "";
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);


  // Replay mode: load beats from Convex into storyBeats
  useEffect(() => {
    if (!isReplay || !replayBeats || replayBeats.length === 0) return;
    const beats: StoryBeat[] = replayBeats.map(b => ({
      narration: b.narration,
      speaker: b.speaker ?? null,
      dialogue: b.dialogue ?? null,
      location: b.location ?? null,
      choices: b.choices,
    }));
    setStoryBeats(beats);
    // Load panel URLs from stored beats
    const urls = replayBeats.map(b => b.panelUrl ?? null);
    setPanelUrls(urls);
    // Show all beats up to replayIndex
    setReplayIndex(beats.length);
  }, [isReplay, replayBeats]);

  // Start the story on mount (skip in replay mode)
  useEffect(() => {
    if (isReplay) return;
    if (mounted && storyBeats.length === 0 && !loading) {
      const { beatIndex, recentBeatNames, lastDialogue } = storyContext;

      if (beatIndex > 0 && (recentBeatNames.length > 0 || lastDialogue)) {
        const landmarks = recentBeatNames.length > 0
          ? `Recent scenes: ${recentBeatNames.join(", ")}.`
          : "";
        const lastLine = lastDialogue
          ? `The last line spoken was — ${lastDialogue}`
          : "";
        sendMessage(
          `Continue the story from where the guided episode left off. ${landmarks} ${lastLine}\n\nPick up naturally from this exact moment — set the atmosphere, then present what happens next and give me choices.`
        );
      } else {
        sendMessage("Begin the scene. Set the atmosphere and present the first moment.");
      }
    }
  }, [mounted]);

  // Derived values from single revealedChars counter
  const currentBeat = storyBeats[storyBeats.length - 1] || null;
  const narration = currentBeat?.narration || "";
  const dialogue = currentBeat?.dialogue || "";
  const totalLength = narration.length + dialogue.length;

  const narrationChars = Math.min(revealedChars, narration.length);
  const dialogueChars = Math.max(0, revealedChars - narration.length);
  const allTextRevealed = !currentBeat || (!streaming && revealedChars >= totalLength);

  // Single typewriter effect — aware of streaming buffer growth (skip in replay)
  useEffect(() => {
    if (!currentBeat) return;

    // In replay mode, instantly reveal all text — no typewriter
    if (isReplay) {
      const currentTotal = narration.length + dialogue.length;
      progressRef.current = currentTotal;
      setRevealedChars(currentTotal);
      return;
    }

    // Reset for new beat
    if (storyBeats.length !== beatCountRef.current) {
      beatCountRef.current = storyBeats.length;
      progressRef.current = 0;
      skipModeRef.current = false;
      setRevealedChars(0);
    }

    // Already done (not streaming)?
    if (!streaming && progressRef.current >= totalLength && totalLength > 0) return;

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      const currentTotal = narration.length + dialogue.length;

      // Skip mode: instantly reveal all buffered text
      if (skipModeRef.current) {
        progressRef.current = currentTotal;
        setRevealedChars(currentTotal);
        if (streaming) {
          setTimeout(tick, 50); // keep polling for new data
        }
        return;
      }

      // Caught up to buffer — wait for more if still streaming
      if (progressRef.current >= currentTotal) {
        if (streaming) {
          setTimeout(tick, 50);
        } else {
          // Stream done, snap to final length
          progressRef.current = currentTotal;
          setRevealedChars(currentTotal);
        }
        return;
      }

      progressRef.current += 3;
      if (progressRef.current > currentTotal) progressRef.current = currentTotal;
      setRevealedChars(progressRef.current);
      setTimeout(tick, 20);
    };

    setTimeout(tick, 20);
    return () => { cancelled = true; };
  }, [storyBeats.length, totalLength, streaming, isReplay]);

  // Panel generation timer
  useEffect(() => {
    if (!panelLoading) {
      setPanelElapsed(0);
      return;
    }
    setPanelElapsed(0);
    const interval = setInterval(() => {
      setPanelElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [panelLoading]);

  // Auto-scroll when content changes (disabled in replay to let user scroll freely)
  useEffect(() => {
    if (!isReplay && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [revealedChars, storyBeats.length, loading, isReplay]);

  const skip = useCallback(() => {
    if (streaming) {
      // Enter skip mode — reveal all buffered text instantly, keep streaming
      skipModeRef.current = true;
      const currentTotal = narration.length + dialogue.length;
      progressRef.current = currentTotal;
      setRevealedChars(currentTotal);
    } else if (currentBeat && !allTextRevealed) {
      progressRef.current = totalLength;
      setRevealedChars(totalLength);
    }
  }, [currentBeat, allTextRevealed, totalLength, streaming, narration.length, dialogue.length]);

  const sendMessage = async (userMessage: string) => {
    // Track choice for session persistence
    lastUserChoiceRef.current = userMessage;

    // Abort any in-flight stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setStreaming(true);
    rawBufferRef.current = "";
    skipModeRef.current = false;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);

    // Push a partial beat so the typewriter can start immediately
    const partialBeat: StoryBeat = {
      narration: "", speaker: null, dialogue: null, location: null, choices: [],
    };
    setStoryBeats(prev => [...prev, partialBeat]);

    try {
      const res = await fetch("/api/episode/chat?stream=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          messages: newMessages,
          mode: sessionMode,
          context: {
            chapterNum: storyContext.chapterNum,
            chapterTitle: storyContext.chapterTitle,
            povCharacter: playAsCharacter || storyContext.povCharacter,
            currentLocation: currentLocation,
            currentCharacters: currentCharacters,
            storyRecap: storyContext.storyRecap,
            characters: storyContext.episodeData?.characters,
            locations: storyContext.episodeData?.locations,
            interactiveModule: interactiveModule,
            chapterRoute: storyContext.chapterRoute,
            chapterMemory: storyContext.chapterMemory,
            seriesContext: storyContext.seriesContext,
            arcContext: storyContext.arcContext,
            characterProfiles: storyContext.characterProfiles,
          },
        }),
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        rawBufferRef.current += decoder.decode(value, { stream: true });

        // Extract partial field values from the growing JSON buffer
        const partialNarration = extractPartialField(rawBufferRef.current, "narration") || "";
        const partialDialogue = isFieldComplete(rawBufferRef.current, "narration")
          ? (extractPartialField(rawBufferRef.current, "dialogue") || "")
          : "";
        const speaker = extractNullableField(rawBufferRef.current, "speaker");

        // Update the last beat with current buffer state
        setStoryBeats(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            narration: partialNarration,
            speaker,
            dialogue: partialDialogue || null,
            location: null,
            choices: [],
          };
          return updated;
        });
      }

      // Stream complete — parse the full response
      const parsed = extractJSON(rawBufferRef.current);
      const fallbackChoices = ["Step closer", "Confront them", "Leave the room"];
      const finalBeat: StoryBeat = parsed && parsed.narration
        ? {
            narration: String(parsed.narration),
            speaker: parsed.speaker ? String(parsed.speaker) : null,
            dialogue: parsed.dialogue ? String(parsed.dialogue) : null,
            location: parsed.location ? String(parsed.location) : null,
            choices: Array.isArray(parsed.choices) && parsed.choices.length > 0
              ? parsed.choices.map(String).slice(0, 3)
              : fallbackChoices,
          }
        : {
            narration: extractPartialField(rawBufferRef.current, "narration")
              || rawBufferRef.current.replace(/[{}"]/g, "").trim().slice(0, 1000)
              || "The story continues...",
            speaker: extractNullableField(rawBufferRef.current, "speaker"),
            dialogue: extractNullableField(rawBufferRef.current, "dialogue"),
            location: extractNullableField(rawBufferRef.current, "location"),
            choices: fallbackChoices,
          };

      // Finalize: update beat, message history, location/character tracking
      setStoryBeats(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = finalBeat;
        return updated;
      });

      setMessages(prev => [...prev, { role: "assistant", content: JSON.stringify(finalBeat) }]);

      if (finalBeat.speaker) {
        setCurrentCharacters(prev => {
          const name = finalBeat.speaker!.toLowerCase();
          if (!prev.some(c => c.toLowerCase() === name)) return [...prev, finalBeat.speaker!];
          return prev;
        });
      }

      // Track location changes from LLM response
      if (finalBeat.location) {
        setCurrentLocation(finalBeat.location);
      }

      // Persist beat to Convex — await session creation if still in flight
      const sid = sessionIdRef.current ?? await sessionReadyRef.current;
      const panelBeatIndex = sid ? (await addBeatMutation({
        sessionId: sid,
        userChoice: lastUserChoiceRef.current,
        narration: finalBeat.narration,
        speaker: finalBeat.speaker ?? undefined,
        dialogue: finalBeat.dialogue ?? undefined,
        location: finalBeat.location ?? undefined,
        choices: finalBeat.choices,
      }).catch((e: unknown) => { console.error("Failed to save beat:", e); return null; }))?.index ?? (storyBeats.length - 1) : (storyBeats.length - 1);

      // Fire panel generation async (non-blocking) — only in illustrated mode
      if (sessionMode === "illustrated") {
        const locationChanged = finalBeat.location !== null && finalBeat.location !== currentLocation;
        generatePanel(finalBeat, panelBeatIndex, locationChanged, sid);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // intentional abort
      console.error("Failed to generate story:", err);

      // Keep whatever text arrived, add fallback choices
      const partialNarration = extractPartialField(rawBufferRef.current, "narration") || "";
      const errorBeat: StoryBeat = {
        narration: partialNarration || "The story wavers for a moment, like a signal losing coherence...",
        speaker: null, dialogue: null, location: null,
        choices: ["Try again", "Push forward", "Change course"],
      };
      setStoryBeats(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = errorBeat;
        return updated;
      });
    } finally {
      setStreaming(false);
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Generate a manga panel for a beat
  const generatePanel = async (beat: StoryBeat, beatIndex: number, locationChanged = false, sid?: Id<"sessions"> | null) => {
    const episodeData = storyContext.episodeData;
    if (!beat.narration) return;

    setPanelLoading(true);

    // Resolve character slugs for ref images — POV character always first
    const characterSlugs: string[] = [];
    const povName = playAsCharacter || storyContext.povCharacter;
    const allNames = [povName, ...currentCharacters.filter(n => n.toLowerCase() !== povName.toLowerCase())];
    if (beat.speaker && !allNames.some(n => n.toLowerCase() === beat.speaker!.toLowerCase())) {
      allNames.splice(1, 0, beat.speaker);
    }
    for (const name of allNames) {
      const char = episodeData?.characters.find(c =>
        c.name.toLowerCase() === name.toLowerCase() ||
        c.name.toLowerCase().split(" ")[0] === name.toLowerCase()
      );
      if (char) characterSlugs.push(char.slug);
    }

    // Build reference image list for display
    const refs: { label: string; url: string }[] = [];
    for (const slug of characterSlugs) {
      const char = episodeData?.characters.find(c => c.slug === slug);
      refs.push({
        label: char?.name || slug,
        url: `/series/${storyContext.seriesId}/world/characters/${slug}.jpg`,
      });
    }
    const beatLocation = beat.location || currentLocation;
    if (beatLocation) {
      const loc = episodeData?.locations?.find(l => l.slug === beatLocation);
      refs.push({
        label: loc?.name || beatLocation.replace(/-/g, " "),
        url: `/series/${storyContext.seriesId}/world/locations/${beatLocation}.jpg`,
      });
    }

    // Only pass previous panel when scene is visually continuous:
    // - Same location (no scene change)
    // - Not the first beat (no previous panel exists)
    const usePreviousPanel = !locationChanged && previousPanelUrlRef.current !== null;
    if (usePreviousPanel && previousPanelUrlRef.current) {
      refs.push({ label: "Previous panel", url: previousPanelUrlRef.current });
    }

    // Store refs for this beat
    setPanelRefs(prev => {
      const updated = [...prev];
      while (updated.length <= beatIndex) updated.push([]);
      updated[beatIndex] = refs;
      return updated;
    });

    try {
      // Submit prediction
      const submitRes = await fetch("/api/episode/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId: storyContext.seriesId,
          narration: beat.narration,
          speaker: beat.speaker,
          dialogue: beat.dialogue,
          location: beat.location || currentLocation,
          povCharacter: playAsCharacter || storyContext.povCharacter,
          characterSlugs,
          previousPanelUrl: usePreviousPanel ? previousPanelUrlRef.current : null,
        }),
      });

      if (!submitRes.ok) throw new Error("Submit failed");
      const { predictionId } = await submitRes.json();

      // Poll until complete
      let panelUrl: string | null = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise(r => setTimeout(r, 2000));
        const pollRes = await fetch(`/api/episode/panel?id=${predictionId}`);
        const data = await pollRes.json();
        if (data.status === "succeeded" && data.panelUrl) {
          panelUrl = data.panelUrl;
          break;
        }
        if (data.status === "failed") break;
      }

      if (panelUrl) {
        // Upload to Convex file storage for permanent persistence
        let storedUrl = panelUrl;
        const activeSessionId = sid ?? sessionIdRef.current;
        if (activeSessionId) {
          try {
            const blob = await fetch(panelUrl).then(r => r.blob());
            const uploadUrl = await generateUploadUrl();
            const uploadRes = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": blob.type },
              body: blob,
            });
            const { storageId } = await uploadRes.json();
            storedUrl = await storePanelImage({
              sessionId: activeSessionId,
              index: beatIndex,
              storageId,
            });
          } catch (e) {
            console.error("Failed to upload panel to Convex:", e);
          }
        }

        setPanelUrls(prev => {
          const updated = [...prev];
          while (updated.length <= beatIndex) updated.push(null);
          updated[beatIndex] = storedUrl;
          return updated;
        });
        previousPanelUrlRef.current = storedUrl;
      }
    } catch (err) {
      console.error("Panel generation failed:", err);
    } finally {
      setPanelLoading(false);
    }
  };

  // Keyboard: 1/2/3 to pick choices, Space/Enter to reveal text
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable) return;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;

      if (allTextRevealed && !loading) {
        const beat = storyBeats[storyBeats.length - 1];
        if (beat?.choices) {
          const num = parseInt(e.key);
          if (num >= 1 && num <= beat.choices.length) {
            e.preventDefault();
            sendMessage(beat.choices[num - 1]);
            return;
          }
        }
      }

      if (e.key === "Enter" && !allTextRevealed) {
        e.preventDefault();
        skip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allTextRevealed, loading, storyBeats, skip]);

  if (!mounted) return null;

  // Resolve visuals
  const episodeData = storyContext.episodeData;
  const locationImage = currentLocation ? locationToImageSrc(storyContext.seriesId, currentLocation, episodeData) : null;

  const speakerName = currentBeat?.speaker || null;
  const speakerImage = speakerName ? characterToImageSrc(storyContext.seriesId, speakerName, episodeData) : null;
  const speakerStyle = speakerName ? getSpeakerStyle(speakerName) : null;

  // Player character info
  const playerName = playAsCharacter || storyContext.povCharacter;
  const playerStyle = getSpeakerStyle(playerName);
  const playerImage = characterToImageSrc(storyContext.seriesId, playerName, episodeData);

  // Location display name
  const locationDisplayName = currentLocation
    ? (episodeData?.locations.find(l => l.slug === currentLocation)?.name
      || currentLocation.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()))
    : null;

  const hasChoices = !isReplay && allTextRevealed && !loading && currentBeat?.choices && currentBeat.choices.length > 0;

  // Characters for the hero section
  const characters = episodeData?.characters || [];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-[#0a0a0f]"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* === Location backdrop with dark filter === */}
      <div className="absolute inset-0 z-0">
        {locationImage ? (
          <>
            <img
              src={locationImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            />
            <div className="absolute inset-0 bg-black/85" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[#0a0a0f]" />
        )}
      </div>

      {/* === Top bar — minimal === */}
      <div className="absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/60 to-transparent">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white/60 hover:text-white transition-all backdrop-blur-sm"
            aria-label="Back"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            {isReplay && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm">
                <span className="text-[10px] text-amber-300/80 font-medium uppercase tracking-wider">Replay</span>
              </div>
            )}
            <SignedIn>
              <TokenBadge />
            </SignedIn>
            {onToggleBgm && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleBgm(); }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all backdrop-blur-sm ${
                  bgmPlaying
                    ? "bg-violet-500/30 text-violet-200"
                    : "bg-black/30 text-white/40 hover:bg-black/50 hover:text-white/60"
                }`}
                aria-label={bgmPlaying ? "Pause music" : "Play music"}
              >
                <MusicalNoteIcon className="w-3.5 h-3.5" />
              </button>
            )}
            {onBackToEpisodes && (
              <button
                onClick={(e) => { e.stopPropagation(); onBackToEpisodes(); }}
                className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white/60 hover:text-white transition-all backdrop-blur-sm"
                aria-label="Close"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* === Full-screen scrollable chat === */}
      <div
        ref={scrollRef}
        className="absolute inset-0 z-10 overflow-y-auto pt-[72px] pb-[env(safe-area-inset-bottom,0px)]"
        onClick={() => { if (!allTextRevealed) skip(); }}
      >
        <div className="max-w-2xl mx-auto px-4">

          {/* === Hero: Chapter intro + overlapping character circles === */}
          <div className="flex flex-col items-center pt-8 pb-6">
            {/* Overlapping character avatars */}
            {characters.length > 0 && (
              <div className="flex items-center justify-center -space-x-4 mb-5">
                {characters.map((char, i) => {
                  const isPlayer = char.name === playerName;
                  const charImage = characterToImageSrc(storyContext.seriesId, char.name, episodeData);
                  const style = getSpeakerStyle(char.name);
                  return (
                    <CharacterPreviewTooltip
                      key={char.slug}
                      character={char}
                      imageSrc={charImage}
                      position="bottom"
                    >
                      <div
                        className="relative group cursor-pointer"
                        style={{ zIndex: characters.length - i }}
                      >
                        {charImage ? (
                          <img
                            src={charImage}
                            alt={char.name}
                            className={`w-20 h-20 rounded-full object-cover border-[3px] ${isPlayer ? "border-emerald-400/60 ring-2 ring-emerald-500/20" : `${style.border} ring-2 ${style.ring}`} bg-slate-900 transition-transform hover:scale-105`}
                          />
                        ) : (
                          <div className={`w-20 h-20 rounded-full ${style.bg} border-[3px] ${style.border} flex items-center justify-center`}>
                            <span className={`text-lg font-bold ${style.text}`}>{char.name[0]}</span>
                          </div>
                        )}
                        {isPlayer && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-[8px] text-white font-bold uppercase tracking-wider">
                            You
                          </span>
                        )}
                      </div>
                    </CharacterPreviewTooltip>
                  );
                })}
              </div>
            )}

            <h2 className="text-white/90 text-lg font-semibold text-center">
              Episode {storyContext.chapterNum}: {storyContext.chapterTitle}
            </h2>
            {storyContext.beatIndex > 0 ? (
              <p className="text-white/30 text-sm mt-1 text-center">
                Continuing from beat {storyContext.beatIndex + 1} of {storyContext.totalBeats}
              </p>
            ) : null}
            {locationDisplayName && (
              <div className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                <MapPinIcon className="w-3.5 h-3.5 text-white/30" />
                <span className="text-white/40 text-xs">{locationDisplayName}</span>
              </div>
            )}
          </div>

          <div className="border-b border-white/[0.06] mb-4" />

          {/* === Chat messages === */}
          <div className="space-y-4 pb-8" onClick={e => e.stopPropagation()}>

            {/* History: previous beats */}
            {storyBeats.slice(0, -1).map((beat, bi) => {
              const pastSpeaker = beat.speaker;
              const pastStyle = pastSpeaker ? getSpeakerStyle(pastSpeaker) : null;
              const pastImage = pastSpeaker ? characterToImageSrc(storyContext.seriesId, pastSpeaker, episodeData) : null;
              const userChoiceIndex = bi > 0 ? bi * 2 : -1;
              const userChoice = userChoiceIndex > 0 ? messages[userChoiceIndex]?.content : null;

              return (
                <div key={bi} className="space-y-3">
                  {/* Player action */}
                  {userChoice && (
                    <div className="flex gap-3 justify-end">
                      <div className={`max-w-[85%] px-4 py-3 rounded-2xl rounded-tr-sm ${playerStyle.bg} border ${playerStyle.border}`}>
                        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${playerStyle.text}`}>{playerName}</p>
                        <p className="text-white/80 text-sm leading-relaxed italic">{userChoice}</p>
                      </div>
                      <CharacterPreviewTooltip
                        character={episodeData?.characters.find(c => c.name === playerName) || null}
                        imageSrc={playerImage}
                        position="top"
                      >
                        {playerImage ? (
                          <img src={playerImage} alt={playerName} className={`w-8 h-8 rounded-full object-cover border-2 ${playerStyle.border} flex-shrink-0 mt-1 cursor-pointer`} />
                        ) : (
                          <div className={`w-8 h-8 rounded-full ${playerStyle.bg} border-2 ${playerStyle.border} flex items-center justify-center flex-shrink-0 mt-1 cursor-pointer`}>
                            <span className={`text-xs font-bold ${playerStyle.text}`}>{playerName[0]}</span>
                          </div>
                        )}
                      </CharacterPreviewTooltip>
                    </div>
                  )}
                  {/* Panel for historical beat — above text */}
                  {panelUrls[bi] && (
                    <div className="mx-1 rounded-xl overflow-hidden">
                      <img
                        src={panelUrls[bi]!}
                        alt="Manga panel"
                        className="w-full rounded-xl border border-white/[0.06]"
                      />
                      {panelRefs[bi]?.length > 0 && (
                        <div className="flex items-center gap-2 px-2 py-2 overflow-x-auto">
                          <span className="text-white/20 text-[10px] uppercase tracking-wider font-medium shrink-0">Refs</span>
                          {panelRefs[bi].map((ref, ri) => (
                            <div key={ri} className="flex items-center gap-1.5 shrink-0">
                              <img
                                src={ref.url}
                                alt={ref.label}
                                className="w-8 h-8 rounded-md object-cover border border-white/10"
                              />
                              <span className="text-white/30 text-[10px]">{ref.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Narration */}
                  <div className="px-1">
                    <p className="text-white/50 text-sm leading-relaxed">{beat.narration}</p>
                  </div>
                  {/* NPC dialogue */}
                  {beat.dialogue && pastSpeaker && (
                    <div className="flex gap-3">
                      <CharacterPreviewTooltip
                        character={episodeData?.characters.find(c => c.name === pastSpeaker) || null}
                        imageSrc={pastImage}
                        position="top"
                      >
                        {pastImage ? (
                          <img src={pastImage} alt={pastSpeaker} className={`w-8 h-8 rounded-full object-cover border-2 ${pastStyle?.border || "border-white/20"} flex-shrink-0 mt-1 cursor-pointer`} />
                        ) : (
                          <div className={`w-8 h-8 rounded-full ${pastStyle?.bg || "bg-white/5"} border-2 ${pastStyle?.border || "border-white/20"} flex items-center justify-center flex-shrink-0 mt-1 cursor-pointer`}>
                            <span className={`text-xs font-bold ${pastStyle?.text || "text-white/50"}`}>{pastSpeaker[0]}</span>
                          </div>
                        )}
                      </CharacterPreviewTooltip>
                      <div className={`max-w-[85%] px-4 py-3 rounded-2xl rounded-tl-sm ${pastStyle?.bg || "bg-white/5"} border ${pastStyle?.border || "border-white/10"}`}>
                        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${pastStyle?.text || "text-white/50"}`}>{pastSpeaker}</p>
                        <p className="text-white/80 text-sm leading-relaxed">&ldquo;{beat.dialogue}&rdquo;</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Latest player choice (before the current beat) */}
            {storyBeats.length > 1 && (
              (() => {
                const idx = (storyBeats.length - 1) * 2;
                const choice = idx > 0 ? messages[idx]?.content : null;
                return choice ? (
                  <div className="flex gap-3 justify-end">
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl rounded-tr-sm ${playerStyle.bg} border ${playerStyle.border}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${playerStyle.text}`}>{playerName}</p>
                      <p className="text-white/90 text-sm leading-relaxed italic">{choice}</p>
                    </div>
                    <CharacterPreviewTooltip
                      character={episodeData?.characters.find(c => c.name === playerName) || null}
                      imageSrc={playerImage}
                      position="top"
                    >
                      {playerImage ? (
                        <img src={playerImage} alt={playerName} className={`w-9 h-9 rounded-full object-cover border-2 ${playerStyle.border} flex-shrink-0 mt-1 cursor-pointer`} />
                      ) : (
                        <div className={`w-9 h-9 rounded-full ${playerStyle.bg} border-2 ${playerStyle.border} flex items-center justify-center flex-shrink-0 mt-1 cursor-pointer`}>
                          <span className={`text-sm font-bold ${playerStyle.text}`}>{playerName[0]}</span>
                        </div>
                      )}
                    </CharacterPreviewTooltip>
                  </div>
                ) : null;
              })()
            )}

            {/* Current beat: panel above text */}
            {/* Panel — generated manga panel for current beat (illustrated mode only) */}
            {sessionMode === "illustrated" && panelLoading && !panelUrls[storyBeats.length - 1] && (
              <div className="mx-1 my-3 rounded-xl overflow-hidden">
                <div className="aspect-[3/4] bg-white/[0.03] border border-white/[0.06] rounded-xl">
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      {/* Spinning circle */}
                      <div className="w-10 h-10 rounded-full border-2 border-violet-500/20 border-t-violet-400 animate-spin" />
                      <span className="text-white/30 text-xs font-medium">Generating panel...</span>
                      {/* Timer */}
                      <span className="text-white/15 text-[11px] font-mono tabular-nums">{panelElapsed}s</span>
                      {/* Disclaimer */}
                      <span className="text-white/10 text-[10px] text-center max-w-[200px] leading-relaxed">
                        Panels typically take 15–30s to generate
                      </span>
                    </div>
                  </div>
                </div>
                {panelRefs[storyBeats.length - 1]?.length > 0 && (
                  <div className="flex items-center gap-2 px-2 py-2 overflow-x-auto">
                    <span className="text-white/20 text-[10px] uppercase tracking-wider font-medium shrink-0">Refs</span>
                    {panelRefs[storyBeats.length - 1].map((ref, ri) => (
                      <div key={ri} className="flex items-center gap-1.5 shrink-0">
                        <img
                          src={ref.url}
                          alt={ref.label}
                          className="w-8 h-8 rounded-md object-cover border border-white/10"
                        />
                        <span className="text-white/30 text-[10px]">{ref.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {panelUrls[storyBeats.length - 1] && (
              <div className="mx-1 my-3 rounded-xl overflow-hidden" style={{ animation: "fadeIn 0.5s ease-out" }}>
                <img
                  src={panelUrls[storyBeats.length - 1]!}
                  alt="Manga panel"
                  className="w-full rounded-xl border border-white/[0.06]"
                />
                {panelRefs[storyBeats.length - 1]?.length > 0 && (
                  <div className="flex items-center gap-2 px-2 py-2 overflow-x-auto">
                    <span className="text-white/20 text-[10px] uppercase tracking-wider font-medium shrink-0">Refs</span>
                    {panelRefs[storyBeats.length - 1].map((ref, ri) => (
                      <div key={ri} className="flex items-center gap-1.5 shrink-0">
                        <img
                          src={ref.url}
                          alt={ref.label}
                          className="w-8 h-8 rounded-md object-cover border border-white/10"
                        />
                        <span className="text-white/30 text-[10px]">{ref.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Narration + dialogue with typewriter */}
            {currentBeat && currentBeat.narration && (
              <>
                {/* Narration */}
                <div
                  className={`px-1 ${!allTextRevealed ? "cursor-pointer" : ""}`}
                  onClick={() => { if (!allTextRevealed) skip(); }}
                >
                  <p className="text-white/80 text-sm sm:text-[15px] leading-relaxed">
                    {currentBeat.narration.slice(0, narrationChars)}
                    {narrationChars < currentBeat.narration.length && (
                      <span className="inline-block w-0.5 h-4 bg-white/50 animate-pulse ml-0.5 align-text-bottom" />
                    )}
                  </p>
                </div>

                {/* Dialogue — appears after narration typewriter catches up */}
                {currentBeat.dialogue && currentBeat.speaker && narrationChars >= currentBeat.narration.length && (
                  <div
                    className={`flex gap-3 ${!allTextRevealed ? "cursor-pointer" : ""}`}
                    onClick={() => { if (!allTextRevealed) skip(); }}
                  >
                    <CharacterPreviewTooltip
                      character={episodeData?.characters.find(c => c.name === speakerName) || null}
                      imageSrc={speakerImage}
                      position="top"
                    >
                      {speakerImage ? (
                        <img src={speakerImage} alt={speakerName || ""} className={`w-9 h-9 rounded-full object-cover border-2 ${speakerStyle?.border || "border-white/20"} flex-shrink-0 mt-1 cursor-pointer`} />
                      ) : (
                        <div className={`w-9 h-9 rounded-full ${speakerStyle?.bg || "bg-white/5"} border-2 ${speakerStyle?.border || "border-white/20"} flex items-center justify-center flex-shrink-0 mt-1 cursor-pointer`}>
                          <span className={`text-sm font-bold ${speakerStyle?.text || "text-white/50"}`}>{speakerName?.[0] || "?"}</span>
                        </div>
                      )}
                    </CharacterPreviewTooltip>
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl rounded-tl-sm ${speakerStyle?.bg || "bg-white/5"} border ${speakerStyle?.border || "border-white/10"}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${speakerStyle?.text || "text-white/50"}`}>{speakerName}</p>
                      <p className="text-white text-sm sm:text-[15px] leading-relaxed">
                        &ldquo;{currentBeat.dialogue.slice(0, dialogueChars)}&rdquo;
                        {dialogueChars < currentBeat.dialogue.length && (
                          <span className="inline-block w-0.5 h-4 bg-white/50 animate-pulse ml-0.5 align-text-bottom" />
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Tap to reveal hint */}
            {currentBeat && currentBeat.narration && !allTextRevealed && (
              <div className="text-center py-1">
                <span className="text-white/15 text-[11px]">tap to reveal</span>
              </div>
            )}

            {/* Choices */}
            {hasChoices && (
              <div className="pt-2 animate-fade-in">
                <p className="text-white/25 text-[11px] uppercase tracking-wider font-medium mb-2.5 px-1">What do you do?</p>
                <div className="space-y-2">
                  {currentBeat.choices.map((choice, ci) => (
                    <button
                      key={ci}
                      onClick={() => sendMessage(choice)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] hover:bg-violet-500/10 border border-white/[0.06] hover:border-violet-500/30 text-left transition-all group"
                    >
                      <span className="w-6 h-6 rounded-lg bg-white/[0.06] group-hover:bg-violet-500/20 flex items-center justify-center text-white/30 group-hover:text-violet-300 text-xs font-mono font-bold transition-all flex-shrink-0">
                        {ci + 1}
                      </span>
                      <span className="text-white/70 group-hover:text-white text-sm transition-all">
                        {choice}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom input — always available when text is revealed (not in replay) */}
            {!isReplay && allTextRevealed && !loading && (
              <div className={hasChoices ? "" : "pt-2 animate-fade-in"}>
                {!hasChoices && (
                  <p className="text-white/25 text-[11px] uppercase tracking-wider font-medium mb-2.5 px-1">What do you do?</p>
                )}
                <CustomChoiceInput onSubmit={sendMessage} povCharacter={playerName} />
              </div>
            )}

            {/* Loading — only visible before first text arrives */}
            {loading && !currentBeat?.narration && (
              <div className="flex items-center gap-3 px-1 py-4">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-violet-400/40 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-violet-400/40 animate-pulse" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-violet-400/40 animate-pulse" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-white/20 text-xs">The story unfolds...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Character preview tooltip on hover + fullscreen on click
function CharacterPreviewTooltip({
  character,
  imageSrc,
  children,
  position = "bottom"
}: {
  character: { name: string } | null;
  imageSrc: string | null;
  children: React.ReactNode;
  position?: "top" | "bottom";
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const description = useWorldMarkdown(imageSrc);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setShowPreview(true), 200);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowPreview(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPreview(false);
    setShowFullscreen(true);
  };

  const closeFullscreen = () => {
    setShowFullscreen(false);
  };

  useEffect(() => {
    if (showFullscreen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") closeFullscreen();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showFullscreen]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!character || !imageSrc) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}
        {showPreview && !showFullscreen && (
          <div
            className={`absolute z-50 w-72 rounded-xl bg-slate-900/95 border border-white/10 backdrop-blur-md shadow-2xl overflow-hidden ${
              position === "bottom"
                ? "top-full mt-2 left-1/2 -translate-x-1/2"
                : "bottom-full mb-2 left-1/2 -translate-x-1/2"
            }`}
            style={{ animation: "fadeIn 0.15s ease-out" }}
          >
            <img
              src={imageSrc}
              alt={character.name}
              className="w-full max-h-80 object-contain bg-black/50"
            />
            <div className="p-3 max-h-48 overflow-y-auto">
              <h4 className="text-white font-semibold text-sm">{character.name}</h4>
              {description && (
                <div className="mt-1">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="text-white/50 text-xs leading-relaxed mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="text-white/70 font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="text-white/40 italic">{children}</em>,
                      code: ({ children }) => <code className="text-violet-300/60 text-[10px] font-mono bg-white/5 px-1 py-0.5 rounded">{children}</code>,
                      pre: ({ children }) => <pre className="text-[10px] bg-white/5 rounded p-2 overflow-x-auto mt-1 mb-2">{children}</pre>,
                    }}
                  >
                    {description}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            {/* Arrow */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900/95 border-white/10 rotate-45 ${
                position === "bottom"
                  ? "-top-1.5 border-l border-t"
                  : "-bottom-1.5 border-r border-b"
              }`}
            />
          </div>
        )}
      </div>

      {/* Fullscreen overlay */}
      {showFullscreen && createPortal(
        <div
          className="fixed inset-0 z-[10000] bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={closeFullscreen}
          style={{ animation: "fadeIn 0.2s ease-out" }}
        >
          <button
            onClick={closeFullscreen}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <img
            src={imageSrc}
            alt={character.name}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mt-4 max-w-lg max-h-[25vh] overflow-y-auto text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white text-xl font-semibold">{character.name}</h3>
            {description && (
              <div className="mt-2 text-left">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="text-white/60 text-sm leading-relaxed mb-3 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="text-white/80 font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="text-white/50 italic">{children}</em>,
                    code: ({ children }) => <code className="text-violet-300/70 text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded">{children}</code>,
                    pre: ({ children }) => <pre className="text-xs bg-white/5 rounded-lg p-3 overflow-x-auto mt-2 mb-3">{children}</pre>,
                  }}
                >
                  {description}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function CustomChoiceInput({ onSubmit, povCharacter }: { onSubmit: (msg: string) => void; povCharacter: string }) {
  const [value, setValue] = useState("");
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setValue("");
      setExpanded(false);
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="mt-2 w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-transparent hover:bg-white/[0.02] border border-dashed border-white/[0.06] hover:border-white/10 text-left transition-all group"
      >
        <span className="w-6 h-6 rounded-lg bg-white/[0.04] group-hover:bg-white/[0.08] flex items-center justify-center text-white/15 group-hover:text-white/30 text-xs font-mono transition-all flex-shrink-0">
          +
        </span>
        <span className="text-white/25 group-hover:text-white/40 text-sm transition-all">
          Write your own action...
        </span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={`What does ${povCharacter} do?`}
        autoFocus
        className="flex-1 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:bg-white/[0.04] disabled:text-white/15 text-white text-sm font-medium transition-all"
      >
        Go
      </button>
    </form>
  );
}

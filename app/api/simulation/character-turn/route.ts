import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { buildGraph, findShortestPath } from "@/lib/pathfinding";

export const runtime = "nodejs";

interface CharacterContext {
  slug: string;
  name: string;
  profile: string; // full .md content
  personality: string;
  goals: string[];
  faction: string | null;
  locationSlug: string;
  mood: string;
  lastAction?: string;
}

interface LocationInfo {
  slug: string;
  name: string;
  description: string;
  connections: { target: string; label: string }[];
}

interface CharacterTurnRequest {
  seriesId: string;
  turn: number;
  character: CharacterContext; // the character to resolve
  allCharacters: CharacterContext[]; // all characters for context
  locations: LocationInfo[];
  recentTurns: { turn: number; worldNarration: string }[];
  influence?: string;
  storyContext?: string; // arc/series narrative context
}

interface AIResponse {
  action: "move" | "interact" | "speak" | "wait";
  target: string | null;
  dialogue: string | null;
  innerThought: string | null;
  narration: string;
  mood: string;
}

async function loadSeriesSource(seriesId: string, filename: string): Promise<string | null> {
  try {
    const filePath = join(process.cwd(), "series", seriesId, filename);
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

function buildCharacterPrompt(
  char: CharacterContext,
  allCharacters: CharacterContext[],
  locations: LocationInfo[],
  recentTurns: { turn: number; worldNarration: string }[],
  storyContext: string,
  influence?: string,
): string {
  const currentLocation = locations.find((l) => l.slug === char.locationSlug);
  const nearbyCharacters = allCharacters.filter(
    (c) => c.slug !== char.slug && c.locationSlug === char.locationSlug,
  );
  const otherCharacters = allCharacters.filter(
    (c) => c.slug !== char.slug && c.locationSlug !== char.locationSlug,
  );
  const connectedLocations = currentLocation?.connections ?? [];

  const sections: string[] = [];

  // Character identity — use the full .md profile
  sections.push(`# You are ${char.name}

${char.profile}

**Personality**: ${char.personality}

## Your Goals
${char.goals.map((g) => `- ${g}`).join("\n")}`);

  // Story context — arc, series lore, chapter history
  sections.push(`# Story Context

${storyContext}`);

  // Current situation
  sections.push(`# Current Situation

## Your Location
**${currentLocation?.name ?? char.locationSlug}** — ${currentLocation?.description ?? ""}
- Current mood: ${char.mood}
- Faction: ${char.faction ?? "Unaligned"}${char.lastAction ? `\n- Your last action: ${char.lastAction}` : ""}`);

  // Characters at your location
  if (nearbyCharacters.length > 0) {
    sections.push(`## Characters Present With You
${nearbyCharacters.map((c) => `- **${c.name}** (${c.faction ?? "unaligned"}) — mood: ${c.mood}${c.lastAction ? `, last: ${c.lastAction}` : ""}\n  ${c.personality}`).join("\n")}`);
  } else {
    sections.push(`## Characters Present With You\nYou are alone here.`);
  }

  // Characters elsewhere (awareness) — with GPS routing
  const graph = buildGraph(locations as any);

  if (otherCharacters.length > 0) {
    sections.push(`## Characters Elsewhere on the Terrace
${otherCharacters.map((c) => {
      const loc = locations.find((l) => l.slug === c.locationSlug);
      const path = findShortestPath(graph, char.locationSlug, c.locationSlug);
      const distance = path ? path.length - 1 : null;
      let gps = "";
      if (distance !== null && distance > 0) {
        const routeNames = path!.slice(1).map((s) => locations.find((l) => l.slug === s)?.name ?? s);
        const nextStepName = routeNames[0];
        gps = `\n  → ${distance} step${distance > 1 ? "s" : ""} away. Route: ${routeNames.join(" → ")}. Next step: ${nextStepName}.`;
      }
      return `- **${c.name}** at ${loc?.name ?? c.locationSlug} (${c.faction ?? "unaligned"}) — mood: ${c.mood}${gps}`;
    }).join("\n")}`);
  }

  // Recent events
  if (recentTurns.length > 0) {
    sections.push(`## Recent Events
${recentTurns.map((t) => `**Turn ${t.turn}:** ${t.worldNarration}`).join("\n\n")}`);
  }

  // Divine influence
  if (influence) {
    sections.push(`## Divine Whisper
You feel a presence guiding your thoughts. A voice speaks to you from beyond:

> ${influence}

This influence shapes your instincts and desires this turn. Filter it through your personality and goals. You may resist if it truly contradicts who you are.`);
  }

  // Available actions — annotate move targets with who they lead toward
  const moveTargets = connectedLocations
    .map((conn) => {
      const loc = locations.find((l) => l.slug === conn.target);
      const reachableViaThis = otherCharacters
        .filter((oc) => {
          const directPath = findShortestPath(graph, char.locationSlug, oc.locationSlug);
          return directPath && directPath.length > 1 && directPath[1] === conn.target;
        })
        .map((oc) => {
          const pathFromConn = findShortestPath(graph, conn.target, oc.locationSlug);
          const remaining = pathFromConn ? pathFromConn.length - 1 : 0;
          return remaining === 0 ? `${oc.name} is here` : `${oc.name} (${remaining} more step${remaining > 1 ? "s" : ""})`;
        });
      const hint = reachableViaThis.length > 0 ? ` [leads toward ${reachableViaThis.join(", ")}]` : "";
      return `- "${conn.target}" (${loc?.name ?? conn.target}) — ${conn.label}${hint}`;
    })
    .join("\n");

  sections.push(`# Available Actions
- **MOVE** to a connected location:
${moveTargets || "  (no connections)"}
- **INTERACT** with a character at your location${nearbyCharacters.length > 0 ? `: ${nearbyCharacters.map((c) => c.name).join(", ")}` : " (nobody here)"}
- **SPEAK** — say something to nearby characters or to yourself
- **WAIT** — stay and observe

## Important Guidelines
- Act in character. Stay true to who you are as described in your profile.
- Your narration should read like a passage from a novel — vivid, atmospheric, specific to this world.
- Reference concrete details from the setting: the luminara trees, the dilation field, Discipline abilities, faction politics.
- Your dialogue should sound like this character — their voice, their cadence, their particular way of expressing themselves.
- Advance the story naturally. Don't repeat what you did last turn. Push toward your goals or react to changing circumstances.
- If another character is present, consider your relationship with them and the subtext beneath any interaction.
- Inner thoughts should reveal what you won't say aloud — fears, desires, strategic calculations.
- Your narration should be 3-4 sentences of vivid third-person prose.`);

  sections.push(`# Response Format
Respond with ONLY valid JSON:
{"action":"move|interact|speak|wait","target":"location-slug or character-slug or null","dialogue":"What you say aloud, or null","innerThought":"What you're thinking privately","narration":"Third-person prose narration of your action (3-4 sentences, novelistic quality)","mood":"Your emotional state (one or two words)"}`);

  return sections.join("\n\n");
}

function extractJSON(text: string): Record<string, unknown> | null {
  const sanitized = text.replace(/\\'/g, "'");
  try {
    return JSON.parse(sanitized);
  } catch {
    /* continue */
  }
  const fenceMatch = sanitized.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {
      /* continue */
    }
  }
  const start = sanitized.indexOf("{");
  const end = sanitized.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(sanitized.slice(start, end + 1));
    } catch {
      /* continue */
    }
  }
  return null;
}

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      max_tokens: 1536,
      temperature: 0.8,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LLM error:", errorText);
    throw new Error(`LLM API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(request: NextRequest) {
  try {
    const body: CharacterTurnRequest = await request.json();
    const {
      seriesId,
      turn,
      character,
      allCharacters,
      locations,
      recentTurns,
      influence,
    } = body;

    const nextTurn = turn + 1;

    // Load story context sources from the series directory
    const [seriesMd, arcMd, worldMd, chapterDraft] = await Promise.all([
      loadSeriesSource(seriesId, "series.md"),
      loadSeriesSource(seriesId, "arcs/1/arc.md"),
      loadSeriesSource(seriesId, "sources/world.md"),
      loadSeriesSource(seriesId, "chapters/1/draft.md"),
    ]);

    // Build condensed story context
    const storyContextParts: string[] = [];

    if (seriesMd) {
      // Extract just the premise and setting sections, not the full file
      const premiseMatch = seriesMd.match(/## Premise\n([\s\S]*?)(?=\n## )/);
      const settingMatch = seriesMd.match(/## Setting\n([\s\S]*?)(?=\n## )/);
      if (premiseMatch) storyContextParts.push(`## Series Premise\n${premiseMatch[1].trim()}`);
      if (settingMatch) storyContextParts.push(`## Setting\n${settingMatch[1].trim()}`);
    }

    if (arcMd) {
      const premiseMatch = arcMd.match(/## Premise\n([\s\S]*?)(?=\n## )/);
      if (premiseMatch) storyContextParts.push(`## Current Arc: The Last Night\n${premiseMatch[1].trim()}`);
    }

    if (worldMd) {
      // Extract the Forgetting and Thrones sections
      const forgettingMatch = worldMd.match(/## The Forgetting\n([\s\S]*?)(?=\n## )/);
      const thronesMatch = worldMd.match(/## The Two Thrones\n([\s\S]*?)(?=\n## (?!The Two))/);
      const terraceMatch = worldMd.match(/## The Ninth Terrace\n([\s\S]*?)(?=\n## (?!The Ninth))/);
      if (forgettingMatch) storyContextParts.push(`## The Forgetting\n${forgettingMatch[1].trim()}`);
      if (thronesMatch) storyContextParts.push(`## The Two Thrones\n${thronesMatch[1].trim()}`);
      if (terraceMatch) storyContextParts.push(`## The Ninth Terrace\n${terraceMatch[1].trim()}`);
    }

    if (chapterDraft) {
      // Provide a summary of what's already happened in the story
      storyContextParts.push(`## What Has Already Happened (Chapter 1)
The story opens with Idris and Sera walking the Grand Promenade after an extraction mission. Their intimacy is shadowed by news of formal dissolution — the Senatorial Council has voted, both Thrones are recalling Adepts, envoys arrive tomorrow. Sera challenges Idris about his refusal to engage. They share a tender moment at the viewing plaza. Two priority military dispatches arrive but neither reads them. The chapter ends with them choosing to hold the moment rather than face what's coming.

The simulation begins the next day — the morning after Chapter 1. Envoys are arriving. The Terrace's neutrality is about to be tested.`);
    }

    const storyContext = storyContextParts.join("\n\n");

    // Build the character prompt
    const prompt = buildCharacterPrompt(
      character,
      allCharacters,
      locations,
      recentTurns.slice(-5),
      storyContext,
      influence,
    );

    const responseText = await callLLM(
      prompt,
      `It is Turn ${nextTurn}. The morning light filters through the Terrace's artificial sky. Decide your action. Stay in character. Advance the story.`,
    );

    const parsed = extractJSON(responseText) as AIResponse | null;

    if (parsed && parsed.action && parsed.narration) {
      return Response.json({
        characterSlug: character.slug,
        actionType: parsed.action,
        actionDetail: `${parsed.action}${parsed.target ? ` → ${parsed.target}` : ""}`,
        targetLocation:
          parsed.action === "move" && parsed.target ? parsed.target : undefined,
        targetCharacter:
          parsed.action === "interact" && parsed.target ? parsed.target : undefined,
        dialogue: parsed.dialogue || undefined,
        innerThought: parsed.innerThought || undefined,
        narration: parsed.narration,
        mood: parsed.mood || character.mood,
      });
    }

    // Fallback
    return Response.json({
      characterSlug: character.slug,
      actionType: "wait",
      actionDetail: "wait",
      narration: `${character.name} remains where they are, observing the Terrace around them.`,
      mood: character.mood,
    });
  } catch (error) {
    console.error("Character turn error:", error);
    return Response.json(
      { error: "Failed to resolve character turn" },
      { status: 500 },
    );
  }
}

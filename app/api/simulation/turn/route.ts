import { NextRequest } from "next/server";

export const runtime = "edge";

interface CharacterContext {
  slug: string;
  name: string;
  profile: string;
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

interface TurnRequest {
  simulationId: string;
  seriesId: string;
  // Current state
  turn: number;
  characters: CharacterContext[];
  locations: LocationInfo[];
  recentTurns: { turn: number; worldNarration: string }[];
  // God-mode influence directives: characterSlug -> directive text
  influences?: Record<string, string>;
  // Player action (if player controls a character)
  playerAction?: {
    characterSlug: string;
    actionType: string;
    actionDetail: string;
    targetLocation?: string;
    targetCharacter?: string;
    dialogue?: string;
  };
}

interface AIResponse {
  action: "move" | "interact" | "speak" | "wait";
  target: string | null;
  dialogue: string | null;
  innerThought: string | null;
  narration: string;
  mood: string;
}

function buildCharacterPrompt(
  char: CharacterContext,
  allCharacters: CharacterContext[],
  locations: LocationInfo[],
  recentTurns: { turn: number; worldNarration: string }[],
  influence?: string,
): string {
  const currentLocation = locations.find((l) => l.slug === char.locationSlug);
  const nearbyCharacters = allCharacters.filter(
    (c) => c.slug !== char.slug && c.locationSlug === char.locationSlug,
  );
  const connectedLocations = currentLocation?.connections ?? [];

  const sections: string[] = [];

  sections.push(`You are **${char.name}**.

${char.profile}

Personality: ${char.personality}`);

  sections.push(`## Your Goals
${char.goals.map((g) => `- ${g}`).join("\n")}`);

  sections.push(`## Current State
- Location: ${currentLocation?.name ?? char.locationSlug} — ${currentLocation?.description ?? ""}
- Mood: ${char.mood}
- Faction: ${char.faction ?? "Unaligned"}${char.lastAction ? `\n- Last action: ${char.lastAction}` : ""}`);

  if (nearbyCharacters.length > 0) {
    sections.push(`## Characters at Your Location
${nearbyCharacters.map((c) => `- **${c.name}** (${c.faction ?? "unaligned"}) — mood: ${c.mood}${c.lastAction ? `, last: ${c.lastAction}` : ""}`).join("\n")}`);
  } else {
    sections.push(`## Characters at Your Location\nYou are alone here.`);
  }

  // Recent events context is added below

  if (recentTurns.length > 0) {
    sections.push(`## Recent Events
${recentTurns.map((t) => `**Turn ${t.turn}:** ${t.worldNarration}`).join("\n\n")}`);
  }

  const moveTargets = connectedLocations
    .map((c) => {
      const loc = locations.find((l) => l.slug === c.target);
      return `- "${c.target}" (${loc?.name ?? c.target}) — ${c.label}`;
    })
    .join("\n");

  if (influence) {
    sections.push(`## Divine Whisper
You feel a presence guiding your thoughts. A voice speaks to you from beyond:

> ${influence}

This influence shapes your instincts and desires this turn. You don't know where this feeling comes from, but it feels compelling. Let it guide your decision — but filter it through your own personality and goals. You may resist if it truly contradicts who you are.`);
  }

  sections.push(`## Available Actions
- **MOVE** to a connected location:
${moveTargets || "  (no connections)"}
- **INTERACT** with a character at your location${nearbyCharacters.length > 0 ? `: ${nearbyCharacters.map((c) => c.name).join(", ")}` : " (nobody here)"}
- **SPEAK** — say something to nearby characters
- **WAIT** — stay and observe

Choose the action that best serves your goals and personality. Act in character. Be proactive — pursue your goals, react to events, initiate confrontations or conversations when it serves you.`);

  sections.push(`## Response Format
Respond with ONLY valid JSON:
{"action":"move|interact|speak|wait","target":"location-slug or character-slug or null","dialogue":"What you say aloud, or null","innerThought":"What you're thinking (private, not heard by others)","narration":"Third-person prose of what you do (2-3 sentences, vivid and specific)","mood":"Your emotional state after this action (one or two words)"}`);

  return sections.join("\n\n");
}

function buildWorldNarrationPrompt(
  actions: { characterSlug: string; narration: string; dialogue?: string | null }[],
  turn: number,
): string {
  const actionSummaries = actions
    .map((a) => {
      let s = `**${a.characterSlug}**: ${a.narration}`;
      if (a.dialogue) s += ` They say: "${a.dialogue}"`;
      return s;
    })
    .join("\n");

  return `You are the narrator of a living world simulation. Synthesize the following character actions into a cohesive 2-3 paragraph world narration for Turn ${turn}. Write in third person, present tense. Be cinematic and atmospheric. Highlight dramatic moments, near-misses, and tension. If characters are in the same location, their actions should interweave.

## Character Actions This Turn
${actionSummaries}

## Instructions
- Weave all actions into a single flowing narrative
- Highlight moments where characters' paths cross or narrowly miss
- Build tension through spatial awareness — who is where, who is moving toward whom
- End with a sense of what's about to happen
- Keep it under 200 words
- Respond with ONLY the narration text, no JSON, no markdown fences`;
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
      max_tokens: 1024,
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
    const body: TurnRequest = await request.json();
    const {
      // simulationId reserved for future persistence
      turn,
      characters,
      locations,
      recentTurns,
      influences,
      playerAction,
    } = body;

    const nextTurn = turn + 1;

    // Resolve each NPC's action via AI (in parallel)
    const npcCharacters = characters.filter(
      (c) => !playerAction || c.slug !== playerAction.characterSlug,
    );

    const aiPromises = npcCharacters.map(async (char) => {
      const prompt = buildCharacterPrompt(
        char,
        characters,
        locations,
        recentTurns.slice(-5),
        influences?.[char.slug],
      );

      const responseText = await callLLM(
        prompt,
        `It is Turn ${nextTurn}. Decide your action.`,
      );

      const parsed = extractJSON(responseText) as AIResponse | null;

      if (parsed && parsed.action && parsed.narration) {
        return {
          characterSlug: char.slug,
          actionType: parsed.action,
          actionDetail: `${parsed.action}${parsed.target ? ` → ${parsed.target}` : ""}`,
          targetLocation:
            parsed.action === "move" && parsed.target
              ? parsed.target
              : undefined,
          targetCharacter:
            parsed.action === "interact" && parsed.target
              ? parsed.target
              : undefined,
          dialogue: parsed.dialogue || undefined,
          innerThought: parsed.innerThought || undefined,
          narration: parsed.narration,
          mood: parsed.mood || char.mood,
        };
      }

      // Fallback if AI response is malformed
      return {
        characterSlug: char.slug,
        actionType: "wait" as const,
        actionDetail: "wait",
        narration: `${char.name} remains where they are, observing.`,
        mood: char.mood,
      };
    });

    const npcActions = await Promise.all(aiPromises);

    // Add player action if present
    const allActions = [...npcActions];
    if (playerAction) {
      const playerChar = characters.find(
        (c) => c.slug === playerAction.characterSlug,
      );
      allActions.push({
        characterSlug: playerAction.characterSlug,
        actionType: playerAction.actionType as "move" | "interact" | "speak" | "wait",
        actionDetail: playerAction.actionDetail,
        targetLocation: playerAction.targetLocation,
        targetCharacter: playerAction.targetCharacter,
        dialogue: playerAction.dialogue,
        innerThought: undefined,
        narration: `${playerChar?.name ?? playerAction.characterSlug} ${playerAction.actionDetail}.`,
        mood: playerChar?.mood ?? "focused",
      });
    }

    // Synthesize world narration
    const worldNarrationPrompt = buildWorldNarrationPrompt(
      allActions,
      nextTurn,
    );
    const worldNarration = await callLLM(
      worldNarrationPrompt,
      "Write the turn narration.",
    );

    // Build character updates (apply movement)
    const characterUpdates = characters.map((char) => {
      const action = allActions.find((a) => a.characterSlug === char.slug);
      const newLocation =
        action?.actionType === "move" && action.targetLocation
          ? action.targetLocation
          : char.locationSlug;

      return {
        characterSlug: char.slug,
        locationSlug: newLocation,
        status: "idle" as const,
        mood: action?.mood ?? char.mood,
        lastAction: action?.actionDetail,
      };
    });

    return Response.json({
      turn: nextTurn,
      worldNarration,
      actions: allActions,
      characterUpdates,
    });
  } catch (error) {
    console.error("Simulation turn error:", error);
    return Response.json(
      { error: "Failed to resolve turn" },
      { status: 500 },
    );
  }
}

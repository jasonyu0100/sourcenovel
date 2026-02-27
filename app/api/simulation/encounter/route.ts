import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

interface EncounterCharacter {
  slug: string;
  name: string;
  profile: string;
  personality: string;
  faction: string | null;
  mood: string;
  goals: string[];
  lastAction?: string;
}

type EncounterType = "convergence" | "crossover" | "near-miss";

interface EncounterRequest {
  seriesId: string;
  turn: number;
  locationName: string;
  locationDescription: string;
  encounterType: EncounterType;
  characters: EncounterCharacter[];
  actions: {
    characterSlug: string;
    narration: string;
    dialogue?: string;
    actionType: string;
  }[];
  recentTurns: { turn: number; worldNarration: string }[];
}

interface ConversationLine {
  speaker: string;
  speakerSlug: string;
  line: string;
  type: "dialogue" | "action" | "thought";
}

async function loadSeriesSource(seriesId: string, filename: string): Promise<string | null> {
  try {
    const filePath = join(process.cwd(), "series", seriesId, filename);
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function callLLM(systemPrompt: string, userMessage: string, maxTokens = 2048): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      max_tokens: maxTokens,
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
    const body: EncounterRequest = await request.json();
    const { seriesId, turn, locationName, locationDescription, encounterType, characters, actions, recentTurns } = body;

    const styleMd = await loadSeriesSource(seriesId, "style.md");

    const characterDescriptions = characters
      .map((c) => {
        const action = actions.find((a) => a.characterSlug === c.slug);
        return `### ${c.name} (slug: "${c.slug}")
- Faction: ${c.faction ?? "Unaligned"}
- Mood: ${c.mood}
- Personality: ${c.personality}
- Goals: ${c.goals.join("; ")}
- What they just did: ${action?.narration ?? "Arrived here"}
${action?.dialogue ? `- They said: "${action.dialogue}"` : ""}

**Full Profile:**
${c.profile}`;
      })
      .join("\n\n");

    const recentContext = recentTurns.length > 0
      ? `\n\n## Recent Events\n${recentTurns.slice(-3).map((t) => `**Turn ${t.turn}:** ${t.worldNarration}`).join("\n\n")}`
      : "";

    const encounterTypeGuidance = encounterType === "crossover"
      ? `## Encounter Type: CROSSING PATHS
These characters are moving in opposite directions and cross each other in transit. This is a brief, charged exchange — they meet on the path between locations. The scene should feel hurried and tense, like two ships passing. Maybe one tries to stop the other. Maybe they exchange a glance loaded with meaning. Maybe a few urgent words. Keep it SHORT (4-8 exchanges) — they are both on their way somewhere.`
      : encounterType === "near-miss"
        ? `## Encounter Type: NEAR MISS
One character has just arrived at this location as the other is leaving. They barely overlap — a fleeting moment. This should feel like catching someone's sleeve as they turn to go. Maybe they only get a few words in. Maybe one sees the other's back disappearing. The brevity makes it poignant. Keep it SHORT (3-6 exchanges) — this is a stolen moment.`
        : `## Encounter Type: CONVERGENCE
These characters have both ended up at the same location. They have time for a real exchange. Write a full dramatic scene (6-12 exchanges) with subtext, tension, and specificity.`;

    const systemPrompt = `You are the encounter narrator for The Ninth Terrace — a sci-fi series about humanity's fracture over the question of mortality. You write dialogue-driven scenes between characters who meet.

${styleMd ? `## Writing Style Guide\n${styleMd}\n` : ""}
${encounterTypeGuidance}

${recentContext}

## Location
**${locationName}** — ${locationDescription}

## Characters Present
${characterDescriptions}

## Guidelines
- Each character must sound distinct — their cadence, vocabulary, and emotional register should reflect their profile
- Include stage directions as [action] lines — small physical gestures, glances, shifts in posture
- Build tension through what's NOT said as much as what is
- Reference the specific setting — the architecture, the light, the ambient sounds of this location
- Characters should pursue their goals subtly through conversation — probing, deflecting, revealing
- If characters have conflicting factions or goals, let that friction surface naturally
- The conversation should feel like it matters — something shifts by the end, even if small
- Keep exchanges tight — 1-3 sentences per line, no monologues
- End on a beat that changes the dynamic — a revelation, a challenge, an exit, a silence

## Response Format
Respond with ONLY a JSON array of conversation lines. IMPORTANT: Use the exact slugs listed above for each character (e.g. ${characters.map((c) => `"${c.slug}"`).join(", ")}).
[
  {"speaker": "${characters[0]?.name ?? "Character Name"}", "speakerSlug": "${characters[0]?.slug ?? "slug"}", "type": "dialogue", "line": "What they say"},
  {"speaker": "${characters[1]?.name ?? characters[0]?.name ?? "Character Name"}", "speakerSlug": "${characters[1]?.slug ?? characters[0]?.slug ?? "slug"}", "type": "action", "line": "Description of what they do"}
]

Types:
- "dialogue" — spoken words (will be shown in quotes)
- "action" — physical action or stage direction (shown in italics)
- "thought" — internal thought (shown differently, use sparingly)`;

    const userMessage = `It is Turn ${turn}. These ${characters.length} characters have converged at ${locationName}. Write their encounter scene. Stay true to each character's voice and goals. Make it feel real.`;

    const responseText = await callLLM(systemPrompt, userMessage);

    // Parse the JSON response
    let conversation: ConversationLine[] = [];
    try {
      // Try direct parse
      conversation = JSON.parse(responseText);
    } catch {
      // Try extracting JSON from markdown fences or finding array
      const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (fenceMatch) {
        try {
          conversation = JSON.parse(fenceMatch[1]);
        } catch { /* continue */ }
      }
      if (conversation.length === 0) {
        const start = responseText.indexOf("[");
        const end = responseText.lastIndexOf("]");
        if (start !== -1 && end > start) {
          try {
            conversation = JSON.parse(responseText.slice(start, end + 1));
          } catch { /* continue */ }
        }
      }
    }

    // Validate the conversation has the right shape
    conversation = conversation.filter(
      (line) => line.speaker && line.line && line.type,
    );

    // Fix speaker slugs — LLM may hallucinate slugs that don't match known characters
    const knownSlugs = new Set(characters.map((c) => c.slug));
    const nameToSlug = new Map(characters.map((c) => [c.name.toLowerCase(), c.slug]));
    for (const line of conversation) {
      if (!knownSlugs.has(line.speakerSlug)) {
        // Try matching by speaker name
        const matchByName = nameToSlug.get(line.speaker.toLowerCase());
        if (matchByName) {
          line.speakerSlug = matchByName;
        } else {
          // Try partial name match (first name)
          const firstName = line.speaker.split(" ")[0].toLowerCase();
          const partialMatch = characters.find((c) => c.name.toLowerCase().startsWith(firstName));
          if (partialMatch) {
            line.speakerSlug = partialMatch.slug;
          }
        }
      }
    }

    if (conversation.length === 0) {
      // Fallback: generate a simple exchange from the existing actions
      for (const char of characters) {
        const action = actions.find((a) => a.characterSlug === char.slug);
        if (action?.dialogue) {
          conversation.push({
            speaker: char.name,
            speakerSlug: char.slug,
            type: "dialogue",
            line: action.dialogue,
          });
        }
      }
    }

    return Response.json({ conversation });
  } catch (error) {
    console.error("Encounter error:", error);
    return Response.json(
      { error: "Failed to generate encounter" },
      { status: 500 },
    );
  }
}

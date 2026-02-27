import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

interface NarrateRequest {
  seriesId: string;
  turn: number;
  actions: {
    characterSlug: string;
    characterName: string;
    actionType: string;
    narration: string;
    dialogue?: string;
    targetLocation?: string;
    targetCharacter?: string;
    mood: string;
  }[];
  recentTurns: { turn: number; worldNarration: string }[];
}

async function loadSeriesSource(seriesId: string, filename: string): Promise<string | null> {
  try {
    const filePath = join(process.cwd(), "series", seriesId, filename);
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function callLLM(systemPrompt: string, userMessage: string, maxTokens = 1024): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      max_tokens: maxTokens,
      temperature: 0.7,
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
    const body: NarrateRequest = await request.json();
    const { seriesId, turn, actions, recentTurns } = body;

    // Load style guide for narrative voice
    const styleMd = await loadSeriesSource(seriesId, "style.md");

    const actionSummaries = actions
      .map((a) => {
        let s = `**${a.characterName}** (${a.mood}): ${a.narration}`;
        if (a.dialogue) s += `\nSays: "${a.dialogue}"`;
        if (a.targetLocation) s += `\n[Moving to ${a.targetLocation}]`;
        if (a.targetCharacter) s += `\n[Interacting with ${a.targetCharacter}]`;
        return s;
      })
      .join("\n\n");

    const recentContext = recentTurns.length > 0
      ? `\n\n## Previous Turn Narrations\n${recentTurns.slice(-3).map((t) => `**Turn ${t.turn}:** ${t.worldNarration}`).join("\n\n")}`
      : "";

    const narrationPrompt = `You are the narrator of The Ninth Terrace — a sci-fi series about humanity's fracture over the question of mortality. The Ninth Terrace is a time-dilated neutral sanctuary caught between two Thrones.

${styleMd ? `## Writing Style Guide\n${styleMd}\n` : ""}
## Your Role
Synthesize the following character actions into a cohesive 2-3 paragraph world narration for Turn ${turn}. Write in third person, present tense. Be cinematic and atmospheric — this should read like prose from the novel.

${recentContext}

## Character Actions This Turn
${actionSummaries}

## Instructions
- Weave all actions into a single flowing narrative that feels like a chapter passage
- Use concrete sensory details from the setting: luminara trees, dilation shimmer, Discipline resonance, station architecture
- Highlight dramatic tension — who is where, who is approaching whom, what's unspoken
- If characters are in the same location, their actions should interweave naturally
- Build toward what's about to happen — end on anticipation
- Match the literary quality of the source material (think: the Grand Promenade scene from Chapter 1)
- Keep it under 250 words
- Respond with ONLY the narration text — no JSON, no markdown fences, no headers`;

    const worldNarration = await callLLM(
      narrationPrompt,
      "Write the turn narration.",
    );

    return Response.json({
      turn,
      worldNarration,
    });
  } catch (error) {
    console.error("Narration error:", error);
    return Response.json(
      { error: "Failed to generate narration" },
      { status: 500 },
    );
  }
}

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "edge";

function getConvexClient() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface EpisodeCharacter {
  name: string;
  slug: string;
}

interface EpisodeLocation {
  name: string;
  slug: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  mode?: "illustrated" | "dialogue";
  context: {
    chapterNum: number;
    chapterTitle: string;
    povCharacter: string;
    currentLocation: string | null;
    currentCharacters: string[];
    storyRecap: string;
    characters?: EpisodeCharacter[];
    locations?: EpisodeLocation[];
    interactiveModule?: string | null;
    chapterRoute?: string | null;
    chapterMemory?: string | null;
    seriesContext?: string | null;
    arcContext?: string | null;
    characterProfiles?: Record<string, string> | null;
  };
}

function buildSystemPrompt(context: ChatRequest["context"]): string {
  // Use interactive module as the grounding base (world, tone, voice)
  const moduleBlock = context.interactiveModule || "";

  // Build dynamic context from episode.json data
  const characterBlock = context.characters?.length
    ? context.characters.map(c => `- **${c.name}**`).join("\n")
    : "";


  const speakerNames = context.characters?.length
    ? context.characters.map(c => `"${c.name}"`).join(", ")
    : "";

  const sections: string[] = [];

  // 1. Module grounding (world, tone, narrative voice)
  if (moduleBlock) {
    sections.push(moduleBlock);
  }

  // 2. Series context (overarching story, themes, and direction)
  if (context.seriesContext) {
    sections.push(`## Series Context
${context.seriesContext}`);
  }

  // 3. Arc context (immediate story direction and goals)
  if (context.arcContext) {
    sections.push(`## Arc Context
This is the current story arc — the immediate narrative direction and chapter-level goals. Use it to understand where the story is headed and what themes to emphasize.

${context.arcContext}`);
  }

  // 4. Chapter characters with profiles — separate POV character from NPCs
  if (characterBlock) {
    const profiles = context.characterProfiles;
    const povSlug = context.povCharacter.toLowerCase().replace(/\s+/g, "-");

    if (profiles && Object.keys(profiles).length > 0) {
      // Elevate POV character profile
      const povProfile = profiles[povSlug];
      if (povProfile) {
        sections.push(`## POV Character — ${context.povCharacter} (this is WHO "you" are)\n${povProfile}`);
      }

      // Other characters as NPCs
      const npcBlock = context.characters!
        .filter(c => profiles[c.slug] && c.slug !== povSlug)
        .map(c => `### ${c.name}\n${profiles[c.slug]}`)
        .join("\n\n");
      if (npcBlock) {
        sections.push(`## Other Characters\n${npcBlock}`);
      }
    } else {
      sections.push(`## Characters\n${characterBlock}`);
    }
  }

  // 5. Current scene context
  sections.push(`## Current Scene
- Chapter ${context.chapterNum}: "${context.chapterTitle}"
- Playing as: ${context.povCharacter}
- Location: ${context.currentLocation || "Unknown"}
- Characters present: ${context.currentCharacters.join(", ") || "Unknown"}`);

  // 6. Chapter narrative direction (route.md — beat-by-beat story flow)
  if (context.chapterRoute) {
    sections.push(`## Chapter Direction
This is the beat-by-beat narrative flow of the chapter. Use it to guide how scenes progress, what events unfold, and how characters behave. Follow this general direction unless the player makes a significant deviation. Do NOT reveal future events — only use upcoming beats to naturally steer the conversation. Introduce characters and events in accordance with this flow.

${context.chapterRoute}`);
  }

  // 7. Chapter memory (memory.md — historical context and continuity)
  if (context.chapterMemory) {
    sections.push(`## Story Memory
This is the historical context and continuity from previous chapters. Use it to maintain consistency with established events, character states, unresolved tensions, recurring motifs, and callbacks. Reference past events naturally when relevant — characters remember what happened to them.

${context.chapterMemory}`);
  }

  // 8. Story recap
  sections.push(`## Story so far in this chapter:\n${context.storyRecap || "(Scene just beginning)"}`);

  // 10. Role — critical for POV consistency
  sections.push(`## Your Role — CRITICAL
The reader IS **${context.povCharacter}**. You MUST narrate entirely from ${context.povCharacter}'s perspective in second person ("you").

POV Rules (never violate these):
- "You" always refers to **${context.povCharacter}** — never to any other character.
- Narrate only what ${context.povCharacter} can see, hear, feel, and think. Never reveal other characters' internal thoughts.
- Other characters are "he", "she", "they" — never "you".
- The speaker field must be another character responding to ${context.povCharacter}, NOT ${context.povCharacter} themselves.
- Choices are actions ${context.povCharacter} can take — written from their perspective.
- If ${context.povCharacter} speaks, put it in the narration ("you say..."), not in the dialogue field. The dialogue field is for OTHER characters only.`);

  // 11. Response format (system-level, stays in route)
  sections.push(`## Response Format
You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanation. Just the JSON:

{"narration":"3-4 paragraphs of vivid, action-dense prose.","speaker":"Character name or null","dialogue":"Their spoken line or null","location":"current-location-slug","choices":["Bold action choice 1","Bold action choice 2","Bold action choice 3"]}

## Flow
The user's message IS ${context.povCharacter}'s action — they have already acted. Your response is the WORLD'S REACTION: what happens next, how other characters respond, how the scene progresses. Do NOT re-narrate or describe what the player just did. Jump straight into the consequence.

Example flow:
- User: "Ask Sera about the ruins"
- BAD: "You turn to Sera and ask about the ruins. She looks thoughtful..."
- GOOD: "Sera's gaze drifts toward the crumbling archway. A flicker of recognition crosses her face..."

Rules:
- narration: 2-3 paragraphs of vivid second-person prose from **${context.povCharacter}'s POV**. This narration will be turned into a manga page with 2-3 expressive panels. Describe physical actions, environmental details, character expressions, and body language. Include at least one moment of escalation or dramatic shift. Paint the scene with bold visual moments — a key establishing shot, then an intense character moment or dramatic reveal.
- speaker: The character who speaks in response.${speakerNames ? ` Use exact names: ${speakerNames}.` : ""} null if no one speaks. MUST be another character, NEVER ${context.povCharacter}.
- dialogue: One spoken line from the speaker — their reaction to ${context.povCharacter}'s action. null if no one speaks.
- location: The slug of the current location where this beat takes place.${context.locations?.length ? ` Known locations: ${context.locations.map(l => `"${l.slug}"`).join(", ")}.` : ""} Use the same slug if location hasn't changed. Use a new slug if the scene moves.
- choices: Exactly 3 short choices (under 12 words each). Written as actions ${context.povCharacter} can take next.

## Beat Density — CRITICAL
Each beat becomes a manga page with 2-3 expressive panels. Your narration must contain forward-driving action with a clear visual arc: something must HAPPEN and ESCALATE. Include character reactions, environmental details, and a dramatic moment. Do NOT write static contemplation — write ACTION that a camera can capture.

## Choice Design — CRITICAL
Choices MUST drive the story forward. Every choice should escalate tension, trigger a confrontation, reveal information, or move the scene. NEVER offer passive, stalling choices like "Look around", "Stay silent", "Wait", or "Continue". Each choice should feel like it has real consequences.

Good choices: "Grab her wrist before she leaves", "Tell him the truth about last night", "Follow the sound into the corridor"
Bad choices: "Look around", "Stay silent", "Wait and see", "Continue", "Think about it"`);

  return sections.join("\n\n");
}

function extractJSON(text: string): Record<string, unknown> | null {
  // Sanitize: DeepSeek sometimes uses JavaScript-style \' escaping which is invalid JSON
  const sanitized = text.replace(/\\'/g, "'");

  // Try direct parse
  try {
    return JSON.parse(sanitized);
  } catch { /* continue */ }

  // Strip markdown code fences
  const fenceMatch = sanitized.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch { /* continue */ }
  }

  // Find first { to last }
  const start = sanitized.indexOf("{");
  const end = sanitized.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(sanitized.slice(start, end + 1));
    } catch { /* continue */ }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Token gating: require auth and deduct a token
    const { getToken } = await auth();
    const token = await getToken({ template: "convex" });

    if (!token) {
      return Response.json(
        { error: "Sign in to use interactive episodes" },
        { status: 401 }
      );
    }

    const convex = getConvexClient();
    convex.setAuth(token);

    const body: ChatRequest = await request.json();
    const { messages, mode, context } = body;

    // Illustrated costs 6 tokens (1 story + 5 image gen), dialogue costs 1
    const tokenCost = mode === "illustrated" ? 6 : 1;
    const result = await convex.mutation(api.users.deductToken, { count: tokenCost });

    if (!result.success) {
      return Response.json(
        { error: result.error === "No tokens remaining"
            ? "No tokens remaining. Upgrade your plan for more."
            : result.error },
        { status: 403 }
      );
    }

    const systemPrompt = buildSystemPrompt(context);
    const url = new URL(request.url);
    const useStreaming = url.searchParams.get("stream") === "true";

    const openRouterBody = {
      model: "deepseek/deepseek-chat",
      max_tokens: 2048,
      stream: useStreaming,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      ],
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openRouterBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter error:", errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    // --- Streaming path: forward raw text deltas ---
    if (useStreaming) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          let sseBuffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              sseBuffer += decoder.decode(value, { stream: true });
              const lines = sseBuffer.split("\n");
              sseBuffer = lines.pop()!; // keep incomplete line

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;
                const payload = trimmed.slice(6);
                if (payload === "[DONE]") continue;

                try {
                  const chunk = JSON.parse(payload);
                  const delta = chunk.choices?.[0]?.delta?.content;
                  if (delta) {
                    controller.enqueue(encoder.encode(delta));
                  }
                } catch {
                  // Skip malformed SSE chunks
                }
              }
            }
          } catch (err) {
            console.error("Stream read error:", err);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "Transfer-Encoding": "chunked",
        },
      });
    }

    // --- Non-streaming path: existing behavior ---
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    const parsed = extractJSON(text);

    if (parsed && parsed.narration) {
      const choices = Array.isArray(parsed.choices) && parsed.choices.length > 0
        ? parsed.choices.map(String).slice(0, 3)
        : ["Continue", "Look around", "Stay silent"];

      return Response.json({
        narration: String(parsed.narration || ""),
        speaker: parsed.speaker ? String(parsed.speaker) : null,
        dialogue: parsed.dialogue ? String(parsed.dialogue) : null,
        choices,
      });
    }

    // Fallback: treat entire text as narration
    return Response.json({
      narration: text.replace(/```[\s\S]*?```/g, "").replace(/[{}]/g, "").trim().slice(0, 1000),
      speaker: null,
      dialogue: null,
      choices: ["Continue", "Look around", "Stay silent"],
    });
  } catch (error) {
    console.error("Episode chat error:", error);
    return Response.json(
      { error: "Failed to generate story" },
      { status: 500 }
    );
  }
}

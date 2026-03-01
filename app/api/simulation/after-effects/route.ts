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
  movedFrom?: string; // set if they moved this turn
}

interface LocationInfo {
  slug: string;
  name: string;
  description: string;
  connections: { target: string; label: string }[];
}

interface PlayerAction {
  characterSlug: string;
  actionType: string;
  actionDetail: string;
  targetLocation?: string;
  targetCharacter?: string;
  dialogue?: string;
  innerThought?: string;
  narration: string;
  mood: string;
}

interface AfterEffectsRequest {
  turn: number;
  characters: CharacterContext[];
  locations: LocationInfo[];
  gameHistory: string;
  influences?: Record<string, string>;
  playerActions?: PlayerAction[];
  interactiveModule?: string | null;
  seriesContext?: string | null;
  arcContext?: string | null;
  chapterRoute?: string | null;
  chapterMemory?: string | null;
  scenarioContext?: string | null;
}

function buildNarrationPrompt(req: AfterEffectsRequest): string {
  const sections: string[] = [];

  // 1. Interactive module — world grounding, tone, voice
  if (req.interactiveModule) {
    sections.push(req.interactiveModule);
  }

  // 2. Series context
  if (req.seriesContext) {
    sections.push(`## Series Context\n${req.seriesContext}`);
  }

  // 3. Arc context
  if (req.arcContext) {
    sections.push(`## Arc Context\nThis is the current story arc — the immediate narrative direction and goals.\n\n${req.arcContext}`);
  }

  // 4. Chapter route
  if (req.chapterRoute) {
    sections.push(`## Chapter Direction\n${req.chapterRoute}`);
  }

  // 5. Chapter memory
  if (req.chapterMemory) {
    sections.push(`## Story Memory\n${req.chapterMemory}`);
  }

  // 5b. Scenario direction
  if (req.scenarioContext) {
    sections.push(`## Scenario Direction\nThis defines the simulation's narrative context — the tensions, relationships, and dramatic beats to drive toward.\n\n${req.scenarioContext}`);
  }

  // 6. Character profiles
  const characterProfiles = req.characters
    .map((c) => {
      const profile = c.profile || c.personality;
      return `### ${c.name} (${c.slug})\n${profile}\n- **Faction**: ${c.faction ?? "Unaligned"}\n- **Goals**: ${c.goals.join("; ")}`;
    })
    .join("\n\n");
  sections.push(`## Characters\n${characterProfiles}`);

  // 7. Locations
  const locationDescriptions = req.locations
    .map((l) => {
      const presentChars = req.characters.filter((ch) => ch.locationSlug === l.slug);
      const presentStr = presentChars.length > 0
        ? `\n  Characters here: ${presentChars.map((c) => c.name).join(", ")}`
        : "";
      return `- **${l.name}** (${l.slug}): ${l.description}${presentStr}`;
    })
    .join("\n");
  sections.push(`## Locations\n${locationDescriptions}`);

  // 8. Resolved positions — who is where, who just arrived, co-location groups
  const locationGroups = new Map<string, CharacterContext[]>();
  for (const c of req.characters) {
    const group = locationGroups.get(c.locationSlug) ?? [];
    group.push(c);
    locationGroups.set(c.locationSlug, group);
  }

  const positionBlock = Array.from(locationGroups.entries())
    .map(([locSlug, chars]) => {
      const loc = req.locations.find((l) => l.slug === locSlug);
      const charLines = chars.map((c) => {
        const arrived = c.movedFrom ? ` (just arrived from ${req.locations.find((l) => l.slug === c.movedFrom)?.name ?? c.movedFrom})` : "";
        return `  - **${c.name}** (mood: ${c.mood})${arrived}`;
      });
      const coLocated = chars.length > 1
        ? `\n  → These characters are together and can interact, speak, react to each other.`
        : `\n  → This character is alone. They act on their own — work, reflect, explore, observe.`;
      return `**${loc?.name ?? locSlug}**:\n${charLines.join("\n")}${coLocated}`;
    })
    .join("\n\n");
  sections.push(`## Resolved Positions (Turn ${req.turn + 1})\nMovement has already been decided. These are the final positions. Now narrate what happens.\n\n${positionBlock}`);

  // 9. Game history
  if (req.gameHistory) {
    sections.push(`## Game History\n${req.gameHistory}`);
  }

  // 10. Player actions
  const playerActionSlugs = new Set((req.playerActions ?? []).map((a) => a.characterSlug));
  if (req.playerActions && req.playerActions.length > 0) {
    const playerBlock = req.playerActions
      .map((a) => {
        const char = req.characters.find((c) => c.slug === a.characterSlug);
        return `- **${char?.name ?? a.characterSlug}**: ${a.actionType}${a.targetCharacter ? ` with ${a.targetCharacter}` : ""}${a.dialogue ? ` — says: "${a.dialogue}"` : ""}`;
      })
      .join("\n");
    sections.push(`## Player Actions (fixed)\nThese characters are player-controlled. Their interactions are pre-decided — write narration for them.\n${playerBlock}`);
  }

  // 11. Divine influences
  const influenceEntries = Object.entries(req.influences ?? {});
  if (influenceEntries.length > 0) {
    const influenceBlock = influenceEntries
      .map(([slug, text]) => {
        const char = req.characters.find((c) => c.slug === slug);
        return `- **${char?.name ?? slug}**: "${text}"`;
      })
      .join("\n");
    sections.push(`## Divine Influences\n${influenceBlock}`);
  }

  // 12. AI characters to resolve
  const aiCharacters = req.characters.filter((c) => !playerActionSlugs.has(c.slug));
  if (aiCharacters.length > 0) {
    const aiList = aiCharacters.map((c) => `- ${c.name} (${c.slug})`).join("\n");
    sections.push(`## Characters to Narrate\n${aiList}`);
  }

  // 13. Response format
  const allSlugs = req.characters.map((c) => c.slug);
  sections.push(`## Response Format
Respond with ONLY valid JSON. No markdown, no code fences, no explanation.

IMPORTANT: Output the "worldNarration" field FIRST, then the "actions" array. This ensures the most important content is generated first.

{
  "worldNarration": "The main narrative output. 3-5 paragraphs of cinematic prose.",
  "actions": [
    {
      "characterSlug": "slug",
      "targetCharacter": "slug or null",
      "dialogue": "Short — what they say aloud, or null",
      "innerThought": "1 sentence — private thought",
      "narration": "2-3 sentences — what they did this turn",
      "mood": "one or two words"
    }
  ]
}

## Writing Guidelines

### worldNarration — THIS IS THE MAIN OUTPUT
Write 3-5 paragraphs of cinematic prose that reads like a chapter from a novel. This is not a summary — it IS the story.
- Weave all character threads into continuous prose. Cut between perspectives cinematically.
- Embed dialogue naturally in the prose. Characters interrupt, deflect, say one thing while meaning another.
- Ground scenes in physical sensation — light, sound, texture, smell.
- End on a beat that propels the story forward.
- Every turn must CHANGE something — a relationship shifts, information surfaces, trust erodes.

### actions — KEEP THESE LEAN
Each character gets a short entry. The worldNarration carries the prose; actions are structured data.
- narration: 2-3 sentences max. What they did, not a full scene.
- dialogue: One key line they said, or null. Not a speech.
- innerThought: One sentence of private thought.
- mood: One or two words.

Rules:
- Include an action entry for EVERY character: ${allSlugs.join(", ")}
- Output worldNarration FIRST, then actions.
- Output worldNarration FIRST to ensure it gets full attention.`);

  return sections.join("\n\n");
}

function extractJSON(text: string): Record<string, unknown> | null {
  const sanitized = text.replace(/\\'/g, "'");
  try {
    return JSON.parse(sanitized);
  } catch { /* continue */ }
  const fenceMatch = sanitized.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch { /* continue */ }
  }
  const start = sanitized.indexOf("{");
  const end = sanitized.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(sanitized.slice(start, end + 1));
    } catch { /* continue */ }
  }
  return null;
}

function normalizeActions(parsed: Record<string, unknown>, body: AfterEffectsRequest) {
  const movements = new Map<string, string | undefined>();
  for (const c of body.characters) {
    if (c.movedFrom) movements.set(c.slug, c.locationSlug);
  }

  const actions = (parsed.actions as Record<string, unknown>[]).map((a) => {
    const slug = String(a.characterSlug || "");
    const moved = movements.has(slug);
    return {
      characterSlug: slug,
      actionType: (moved ? "move" : "interact") as "move" | "interact",
      actionDetail: moved ? `move → ${movements.get(slug)}` : "interact",
      targetLocation: moved ? movements.get(slug) : undefined,
      targetCharacter: a.targetCharacter ? String(a.targetCharacter) : undefined,
      dialogue: a.dialogue ? String(a.dialogue) : undefined,
      innerThought: a.innerThought ? String(a.innerThought) : undefined,
      narration: String(a.narration || `${slug} waits quietly.`),
      mood: String(a.mood || "neutral"),
    };
  });

  // Ensure all characters have an action
  for (const char of body.characters) {
    if (!actions.find((a) => a.characterSlug === char.slug)) {
      const moved = movements.has(char.slug);
      actions.push({
        characterSlug: char.slug,
        actionType: moved ? "move" : "interact",
        actionDetail: moved ? `move → ${movements.get(char.slug)}` : "interact",
        targetLocation: moved ? movements.get(char.slug) : undefined,
        targetCharacter: undefined,
        dialogue: undefined,
        innerThought: undefined,
        narration: `${char.name} remains where they are, observing.`,
        mood: char.mood,
      });
    }
  }

  return actions;
}

function fallbackResponse(body: AfterEffectsRequest) {
  const movements = new Map<string, string | undefined>();
  for (const c of body.characters) {
    if (c.movedFrom) movements.set(c.slug, c.locationSlug);
  }

  const actions = body.characters.map((c) => {
    const moved = movements.has(c.slug);
    return {
      characterSlug: c.slug,
      actionType: (moved ? "move" : "interact") as "move" | "interact",
      actionDetail: moved ? `move → ${movements.get(c.slug)}` : "interact",
      targetLocation: moved ? movements.get(c.slug) : undefined,
      targetCharacter: undefined,
      dialogue: undefined,
      innerThought: undefined,
      narration: `${c.name} remains where they are, observing.`,
      mood: c.mood,
    };
  });

  return {
    turn: body.turn + 1,
    actions,
    worldNarration: "The Terrace turns quietly, its inhabitants lost in thought.",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: AfterEffectsRequest = await request.json();
    const nextTurn = body.turn + 1;
    const systemPrompt = buildNarrationPrompt(body);

    const llmMessages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Turn ${nextTurn}: Movement is resolved. Write worldNarration FIRST (3-5 paragraphs of cinematic prose), then the actions array (keep each action entry short — 2-3 sentence narration max). Output valid JSON only.`,
      },
    ];

    // Streaming path with thinking (DeepSeek R1)
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1",
        max_tokens: 16384,
        stream: true,
        messages: llmMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LLM stream error:", errorText);
      throw new Error(`LLM API error: ${response.status}`);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        let sseBuffer = "";
        let contentAccum = "";

        function sendSSE(event: string, data: string) {
          // data is sent raw — for thinking it's plain text, for result it's a JSON string
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop()!;

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const payload = trimmed.slice(6);
              if (payload === "[DONE]") continue;

              try {
                const chunk = JSON.parse(payload);
                const delta = chunk.choices?.[0]?.delta;
                if (!delta) continue;

                // Reasoning/thinking tokens (DeepSeek R1)
                const thinking = delta.reasoning_content || delta.reasoning;
                if (thinking) {
                  sendSSE("thinking", thinking);
                }

                // Content tokens (the actual JSON response)
                if (delta.content) {
                  contentAccum += delta.content;
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }

          // Parse accumulated content and send final result
          console.log("contentAccum length:", contentAccum.length);
          console.log("contentAccum tail:", contentAccum.slice(-300));
          const parsed = extractJSON(contentAccum);

          if (!parsed) {
            const start = contentAccum.indexOf("{");
            const end = contentAccum.lastIndexOf("}");
            if (start !== -1 && end > start) {
              try {
                JSON.parse(contentAccum.slice(start, end + 1));
              } catch (e) {
                console.error("JSON parse error:", (e as Error).message);
              }
            }
          }

          console.log("parsed result:", parsed ? "OK" : "FAILED", parsed ? `actions: ${Array.isArray(parsed.actions)}, worldNarration: ${!!parsed.worldNarration}` : "");
          if (parsed && Array.isArray(parsed.actions) && parsed.worldNarration) {
            const actions = normalizeActions(parsed, body);
            sendSSE("result", JSON.stringify({
              turn: nextTurn,
              actions,
              worldNarration: String(parsed.worldNarration),
            }));
          } else {
            console.warn("Falling back — contentAccum tail:", contentAccum.slice(-500));
            sendSSE("result", JSON.stringify(fallbackResponse(body)));
          }
        } catch (err) {
          console.error("Stream read error:", err);
          sendSSE("result", JSON.stringify(fallbackResponse(body)));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("After-effects error:", error);
    return Response.json(
      { error: "Failed to generate narration" },
      { status: 500 },
    );
  }
}

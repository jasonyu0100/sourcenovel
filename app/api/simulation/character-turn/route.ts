import { NextRequest } from "next/server";

export const runtime = "edge";

// --- Inline pathfinding (BFS shortest path) ---

function buildGraph(locations: { slug: string; connections: { target: string }[] }[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const loc of locations) {
    graph.set(loc.slug, loc.connections.map((c) => c.target));
  }
  return graph;
}

function findShortestPath(graph: Map<string, string[]>, start: string, goal: string): string[] | null {
  if (start === goal) return [start];
  const visited = new Set<string>([start]);
  const parent = new Map<string, string>();
  const queue: string[] = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of graph.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);
      if (neighbor === goal) {
        const path: string[] = [goal];
        let node = goal;
        while (parent.has(node)) {
          node = parent.get(node)!;
          path.unshift(node);
        }
        return path;
      }
      queue.push(neighbor);
    }
  }
  return null;
}

interface CharacterContext {
  slug: string;
  name: string;
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

interface PlayerMovement {
  characterSlug: string;
  decision: "move" | "stay";
  targetLocation?: string;
}

interface MovementRequest {
  turn: number;
  characters: CharacterContext[];
  locations: LocationInfo[];
  gameHistory: string;
  influences?: Record<string, string>;
  playerMovements?: PlayerMovement[];
  scenarioContext?: string | null;
  arcContext?: string | null;
  seriesContext?: string | null;
}

function buildMovementPrompt(req: MovementRequest): string {
  const sections: string[] = [];

  sections.push(`# Movement Phase — Turn ${req.turn + 1}\nYou are deciding WHERE each character moves this turn. Movement only — no dialogue, no narration. Just strategic positioning.`);

  if (req.scenarioContext) {
    sections.push(`## Scenario\n${req.scenarioContext}`);
  }

  if (req.arcContext) {
    sections.push(`## Arc Context\n${req.arcContext}`);
  }

  // Character summaries (lean — no full profiles)
  const charBlock = req.characters
    .map((c) => `- **${c.name}** (${c.slug}): ${c.personality}\n  Goals: ${c.goals.join("; ")}\n  Faction: ${c.faction ?? "Unaligned"}`)
    .join("\n");
  sections.push(`## Characters\n${charBlock}`);

  // Current state with GPS
  const graph = buildGraph(req.locations);
  const stateBlock = req.characters
    .map((c) => {
      const loc = req.locations.find((l) => l.slug === c.locationSlug);
      const nearby = req.characters.filter((o) => o.slug !== c.slug && o.locationSlug === c.locationSlug);
      const elsewhere = req.characters.filter((o) => o.slug !== c.slug && o.locationSlug !== c.locationSlug);
      const nearbyStr = nearby.length > 0 ? nearby.map((n) => n.name).join(", ") : "alone";

      const gpsLines = elsewhere.map((o) => {
        const oLoc = req.locations.find((l) => l.slug === o.locationSlug);
        const path = findShortestPath(graph, c.locationSlug, o.locationSlug);
        const dist = path ? path.length - 1 : null;
        if (dist !== null && dist > 0) {
          const nextStep = req.locations.find((l) => l.slug === path![1])?.name ?? path![1];
          return `    → ${o.name} at ${oLoc?.name ?? o.locationSlug} (${dist} step${dist > 1 ? "s" : ""}, next: ${nextStep})`;
        }
        return `    → ${o.name} at ${oLoc?.name ?? o.locationSlug} (unreachable)`;
      });

      const connectedLocs = loc?.connections ?? [];
      const moveHints = connectedLocs.map((conn) => {
        const connLoc = req.locations.find((l) => l.slug === conn.target);
        const reachable = elsewhere.filter((oc) => {
          const directPath = findShortestPath(graph, c.locationSlug, oc.locationSlug);
          return directPath && directPath.length > 1 && directPath[1] === conn.target;
        }).map((oc) => oc.name);
        const hint = reachable.length > 0 ? ` [toward ${reachable.join(", ")}]` : "";
        return `    - ${connLoc?.name ?? conn.target} (${conn.target})${hint}`;
      });

      let block = `- **${c.name}** at ${loc?.name ?? c.locationSlug} (mood: ${c.mood})${c.lastAction ? ` — last: ${c.lastAction}` : ""} — nearby: ${nearbyStr}`;
      if (gpsLines.length > 0) block += `\n  Distances:\n${gpsLines.join("\n")}`;
      if (moveHints.length > 0) block += `\n  Can move to:\n${moveHints.join("\n")}`;
      return block;
    })
    .join("\n\n");
  sections.push(`## Current Positions\n${stateBlock}`);

  if (req.gameHistory) {
    sections.push(`## Game History\n${req.gameHistory}`);
  }

  // Player movements already decided
  const playerSlugs = new Set((req.playerMovements ?? []).map((p) => p.characterSlug));
  if (req.playerMovements && req.playerMovements.length > 0) {
    const playerBlock = req.playerMovements
      .map((p) => {
        const char = req.characters.find((c) => c.slug === p.characterSlug);
        return `- **${char?.name ?? p.characterSlug}**: ${p.decision}${p.targetLocation ? ` → ${p.targetLocation}` : ""}`;
      })
      .join("\n");
    sections.push(`## Player Movements (fixed)\n${playerBlock}`);
  }

  // Divine influences
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

  // Characters to resolve
  const aiCharacters = req.characters.filter((c) => !playerSlugs.has(c.slug));
  if (aiCharacters.length > 0) {
    const aiList = aiCharacters.map((c) => `- ${c.name} (${c.slug})`).join("\n");
    sections.push(`## Characters to Resolve\n${aiList}`);
  }

  // Response format
  const allSlugs = req.characters.map((c) => c.slug);
  sections.push(`## Response Format
Respond with ONLY valid JSON. No markdown, no code fences:

{
  "movements": [
    {
      "characterSlug": "slug",
      "decision": "move" or "stay",
      "targetLocation": "location-slug or null",
      "reasoning": "One sentence explaining why"
    }
  ]
}

Rules:
- Include a movement entry for EVERY character: ${allSlugs.join(", ")}
- "move": travel to a connected location. targetLocation must be a valid connected location slug.
- "stay": remain at current location. targetLocation should be null.
- Characters can only move to directly connected locations.
- Think strategically: characters move toward their goals, toward or away from other characters based on motivation.
- Don't move everyone every turn — staying is a valid choice when a character has reason to remain.`);

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

export async function POST(request: NextRequest) {
  try {
    const body: MovementRequest = await request.json();
    const nextTurn = body.turn + 1;
    const systemPrompt = buildMovementPrompt(body);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        max_tokens: 2048,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Turn ${nextTurn}: Decide movement for all characters. Think strategically about positioning.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LLM error:", errorText);
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(text);

    if (parsed && Array.isArray(parsed.movements)) {
      // Build a set of valid location slugs for validation
      const validSlugs = new Set(body.locations.map((l) => l.slug));
      // Build adjacency map: location -> set of connected slugs
      const adjacency = new Map<string, Set<string>>();
      for (const loc of body.locations) {
        adjacency.set(loc.slug, new Set(loc.connections.map((c) => c.target)));
      }

      const movements = (parsed.movements as Record<string, unknown>[]).map((m) => {
        const slug = String(m.characterSlug || "");
        const char = body.characters.find((c) => c.slug === slug);
        const currentLoc = char?.locationSlug;
        const target = m.decision === "move" && m.targetLocation ? String(m.targetLocation) : undefined;

        // Validate: target must be a real location AND connected to the character's current location
        const isValidMove = target
          && validSlugs.has(target)
          && currentLoc
          && adjacency.get(currentLoc)?.has(target);

        if (m.decision === "move" && target && !isValidMove) {
          console.warn(`Invalid move for ${slug}: ${currentLoc} → ${target} (not a valid connected location). Forcing stay.`);
        }

        return {
          characterSlug: slug,
          decision: (m.decision === "move" && isValidMove ? "move" : "stay") as "move" | "stay",
          targetLocation: isValidMove ? target : undefined,
          reasoning: String(m.reasoning || ""),
        };
      });

      // Ensure all characters have a movement decision
      for (const char of body.characters) {
        if (!movements.find((m) => m.characterSlug === char.slug)) {
          movements.push({
            characterSlug: char.slug,
            decision: "stay",
            targetLocation: undefined,
            reasoning: `${char.name} remains at their current position.`,
          });
        }
      }

      return Response.json({ turn: nextTurn, movements });
    }

    // Fallback — everyone stays
    const fallbackMovements = body.characters.map((c) => ({
      characterSlug: c.slug,
      decision: "stay" as const,
      targetLocation: undefined,
      reasoning: `${c.name} stays put.`,
    }));

    return Response.json({ turn: nextTurn, movements: fallbackMovements });
  } catch (error) {
    console.error("Movement phase error:", error);
    return Response.json(
      { error: "Failed to resolve character movements" },
      { status: 500 },
    );
  }
}

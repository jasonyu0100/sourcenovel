import { NextRequest } from "next/server";

export const runtime = "nodejs";

interface AfterEffectsRequest {
  encounters: {
    encounterType: "convergence" | "crossover" | "near-miss";
    characterSlugs: string[];
    characterNames: string[];
    conversation: { speaker: string; speakerSlug: string; line: string; type: string }[] | null;
  }[];
  currentRelationships: { [pairKey: string]: number };
}

interface RelationshipDelta {
  characterA: string;
  characterB: string;
  delta: number;
  reason: string;
}

async function callLLM(systemPrompt: string, userMessage: string, maxTokens = 512): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      max_tokens: maxTokens,
      temperature: 0.6,
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
    const body: AfterEffectsRequest = await request.json();
    const { encounters, currentRelationships } = body;

    if (encounters.length === 0) {
      return Response.json({ deltas: [] });
    }

    const encounterSummaries = encounters.map((enc, i) => {
      const pairKeys = [];
      for (let a = 0; a < enc.characterSlugs.length; a++) {
        for (let b = a + 1; b < enc.characterSlugs.length; b++) {
          const key = [enc.characterSlugs[a], enc.characterSlugs[b]].sort().join(":");
          const current = currentRelationships[key] ?? 0;
          pairKeys.push(`${enc.characterNames[a]} ↔ ${enc.characterNames[b]} (current: ${current})`);
        }
      }

      const convoText = enc.conversation
        ? enc.conversation.map((l) => `${l.speaker}: ${l.line}`).join("\n")
        : "(no dialogue)";

      return `### Encounter ${i + 1} (${enc.encounterType})
Characters: ${enc.characterNames.join(", ")}
Pairs: ${pairKeys.join("; ")}

Dialogue:
${convoText}`;
    }).join("\n\n");

    const allPairs: { slugA: string; slugB: string; nameA: string; nameB: string }[] = [];
    for (const enc of encounters) {
      for (let a = 0; a < enc.characterSlugs.length; a++) {
        for (let b = a + 1; b < enc.characterSlugs.length; b++) {
          const key = [enc.characterSlugs[a], enc.characterSlugs[b]].sort().join(":");
          if (!allPairs.find((p) => [p.slugA, p.slugB].sort().join(":") === key)) {
            allPairs.push({
              slugA: enc.characterSlugs[a],
              slugB: enc.characterSlugs[b],
              nameA: enc.characterNames[a],
              nameB: enc.characterNames[b],
            });
          }
        }
      }
    }

    const pairList = allPairs.map((p, i) => `${i}: ${p.nameA} ↔ ${p.nameB}`).join("\n");

    const systemPrompt = `You analyze character encounters and determine relationship changes. Given dialogue exchanges between characters, determine how each pair's relationship score should change.

Scores range from -100 (mortal enemies) to 100 (inseparable bond). Changes should be small and realistic:
- Friendly exchange: +3 to +8
- Tense but civil: -2 to +2
- Hostile confrontation: -5 to -15
- Moment of vulnerability/connection: +5 to +15
- Betrayal or insult: -10 to -20
- Brief/passing encounter: -1 to +3

Respond with ONLY a JSON array using the pair index number to identify each pair:
[{"pair": 0, "delta": 5, "reason": "brief description"}]`;

    const userMessage = `Analyze these encounters and determine relationship changes for each character pair:

${encounterSummaries}

Character pairs to evaluate (by index):
${pairList}`;

    const responseText = await callLLM(systemPrompt, userMessage);

    let rawDeltas: { pair: number; delta: number; reason?: string }[] = [];
    try {
      rawDeltas = JSON.parse(responseText);
    } catch {
      const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (fenceMatch) {
        try { rawDeltas = JSON.parse(fenceMatch[1]); } catch { /* continue */ }
      }
      if (rawDeltas.length === 0) {
        const start = responseText.indexOf("[");
        const end = responseText.lastIndexOf("]");
        if (start !== -1 && end > start) {
          try { rawDeltas = JSON.parse(responseText.slice(start, end + 1)); } catch { /* continue */ }
        }
      }
    }

    // Map indexed responses back to known slugs
    const deltas: RelationshipDelta[] = rawDeltas
      .filter((d) => typeof d.pair === "number" && typeof d.delta === "number" && allPairs[d.pair])
      .map((d) => {
        const pair = allPairs[d.pair];
        const [a, b] = [pair.slugA, pair.slugB].sort();
        return {
          characterA: a,
          characterB: b,
          delta: Math.max(-20, Math.min(20, Math.round(d.delta))),
          reason: d.reason || "interaction",
        };
      });

    return Response.json({ deltas });
  } catch (error) {
    console.error("After-effects error:", error);
    return Response.json({ deltas: [] });
  }
}

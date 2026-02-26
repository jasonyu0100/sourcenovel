import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { PanelRequest } from "@/lib/episode-types";

export const runtime = "edge";

// Seedream 4.5 via Replicate
const REPLICATE_MODEL_URL =
  "https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions";

const NEGATIVE_PROMPT =
  "watermark, chibi, super deformed, moe, kawaii, pastel, soft, cute, gentle, western comic, realistic, photorealistic, cartoonish, rounded, bubbly";

// Seedream 4.5 custom size — 3:4 portrait manga page, meets 3.6M min pixel count
const GEN_WIDTH = 1680;
const GEN_HEIGHT = 2240;

const PANEL_PROMPT_SYSTEM = `You are a manga art director. Given a story beat, write an image generation prompt for a manga page with 2-3 dynamic panels.

CRITICAL: Your output MUST be under 1900 characters total.

## Format

Page header (1 line): "Full colour manga page, [N] panel layout, clean black gutters, cinematic anime rendering, detailed linework, vibrant cel shading, dramatic lighting, high resolution illustration."

Then Panel 1, Panel 2, (Panel 3 if needed) — each 2-3 sentences max.

## Panel Rules

- 2 panels for emotional moments. 3 panels for action sequences.
- Vary shot types: wide establishing, medium shot, close-up, extreme close-up, dynamic diagonal, low/high angle.
- Each panel: shot type, character pose + facial expression, lighting direction + colour, environment details.
- Panel 1: set the scene. Final panel: escalation or reveal.
- Convert "you" to third-person. All characters keep their names.
- If dialogue is provided, add a speech bubble in ONE panel — white bubble, black outline, max 8 words.

## CRITICAL — Language Rules

Write ONLY literal, physical descriptions. Describe exactly what a camera would photograph.

NEVER use:
- Metaphors or similes ("like a ripple", "as if carved from ice", "predatory grace")
- Abstract concepts ("tension hangs in the air", "the weight of unspoken words")
- Personification ("the corridor hums", "shadows dance", "frost creeps")
- Symbolic language ("a crack forming in the ice of his composure")
- Emotional labels ("suspenseful atmosphere", "charged with tension")

INSTEAD write:
- Exact body positions ("left hand gripping the railing, knuckles white")
- Specific facial details ("eyebrows drawn together, jaw clenched, lips pressed thin")
- Concrete environment ("fluorescent ceiling lights reflected on polished steel floor, frost visible on wall panels")
- Observable actions ("she leans forward, fingers pressing against his collar, mouth close to his ear")
- Measurable distances and spatial relationships ("standing two metres apart in a narrow corridor")

Every word must describe something VISIBLE. If you cannot draw it, do not write it.

Output ONLY the prompt text. No explanation, no markdown.`;

/**
 * Use a fast LLM to transform story beat into cinematic panel direction.
 */
async function generatePanelPrompt(
  narration: string,
  speaker: string | null,
  dialogue: string | null,
  location: string | null,
  povCharacter: string
): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    throw new Error("OPENROUTER_API_KEY is required for panel prompt generation");
  }

  const beatDescription = [
    `POV Character: ${povCharacter} (this is who "you" refers to — use their name)`,
    `Narration: ${narration}`,
    speaker ? `Speaker: ${speaker}` : null,
    dialogue ? `Dialogue: "${dialogue}"` : null,
    location ? `Location: ${location.replace(/-/g, " ")}` : null,
  ].filter(Boolean).join("\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      max_tokens: 512,
      temperature: 0.7,
      messages: [
        { role: "system", content: PANEL_PROMPT_SYSTEM },
        { role: "user", content: beatDescription },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Panel prompt LLM error: ${errText}`);
  }

  const data = await res.json();
  const prompt = data.choices?.[0]?.message?.content?.trim();
  if (!prompt) {
    throw new Error("Empty response from panel prompt LLM");
  }
  return prompt;
}

/**
 * Fetch an image URL and return it as a base64 data URI.
 */
async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * POST — Submit a panel generation prediction. Returns { predictionId }.
 */
export async function POST(request: NextRequest) {
  try {
    const { getToken } = await auth();
    const token = await getToken({ template: "convex" });
    if (!token) {
      return Response.json(
        { error: "Sign in to use interactive episodes" },
        { status: 401 }
      );
    }

    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return Response.json(
        { error: "Image generation not configured" },
        { status: 500 }
      );
    }

    const body: PanelRequest = await request.json();
    const { seriesId, narration, speaker, dialogue, location, povCharacter, characterSlugs, previousPanelUrl } = body;

    // Use LLM to generate cinematic panel prompt from story beat
    const prompt = await generatePanelPrompt(narration, speaker, dialogue, location, povCharacter);

    // Build reference images array (character refs + previous panel + location)
    const imageUris: string[] = [];
    const origin = request.nextUrl.origin;

    // Fetch character reference images (speaker first, then others, max 3)
    const speakerSlug = speaker
      ? characterSlugs.find(s => s === speaker.toLowerCase().replace(/\s+/g, "-")) ||
        characterSlugs.find(s => speaker.toLowerCase().startsWith(s.split("-")[0]))
      : null;

    const orderedSlugs = speakerSlug
      ? [speakerSlug, ...characterSlugs.filter(s => s !== speakerSlug)]
      : characterSlugs;

    for (const slug of orderedSlugs) {
      const uri = await fetchAsDataUri(
        `${origin}/series/${seriesId}/world/characters/${slug}.jpg`
      );
      if (uri) imageUris.push(uri);
    }

    // Fetch location reference if available
    if (location) {
      const locUri = await fetchAsDataUri(
        `${origin}/series/${seriesId}/world/locations/${location}.jpg`
      );
      if (locUri) imageUris.push(locUri);
    }

    // Fetch previous panel for coherence (only when provided — caller decides)
    if (previousPanelUrl) {
      const prevUri = await fetchAsDataUri(previousPanelUrl);
      if (prevUri) imageUris.push(prevUri);
    }

    // Submit prediction to Replicate
    const inputData: Record<string, unknown> = {
      prompt,
      size: "custom",
      width: GEN_WIDTH,
      height: GEN_HEIGHT,
      enhance_prompt: true,
      max_images: 1,
      sequential_image_generation: "auto",
      negative_prompt: NEGATIVE_PROMPT,
    };

    if (imageUris.length > 0) {
      inputData.image_input = imageUris;
    }

    const replicateRes = await fetch(REPLICATE_MODEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: inputData }),
    });

    if (!replicateRes.ok) {
      const errText = await replicateRes.text();
      console.error("Replicate submit error:", errText);
      return Response.json(
        { error: "Failed to start panel generation" },
        { status: 502 }
      );
    }

    const data = await replicateRes.json();
    const predictionId = data.id;

    if (!predictionId) {
      return Response.json(
        { error: "No prediction ID returned" },
        { status: 502 }
      );
    }

    return Response.json({ predictionId });
  } catch (error) {
    console.error("Panel submit error:", error);
    return Response.json(
      { error: "Failed to generate panel" },
      { status: 500 }
    );
  }
}

/**
 * GET — Poll prediction status. Returns { status, panelUrl }.
 */
export async function GET(request: NextRequest) {
  try {
    const { getToken } = await auth();
    const token = await getToken({ template: "convex" });
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return Response.json({ error: "Not configured" }, { status: 500 });
    }

    const predictionId = request.nextUrl.searchParams.get("id");
    if (!predictionId) {
      return Response.json({ error: "Missing prediction ID" }, { status: 400 });
    }

    const res = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );

    if (!res.ok) {
      return Response.json({ status: "failed", panelUrl: null });
    }

    const data = await res.json();
    const status = data.status;

    if (status === "succeeded") {
      const panelUrl = Array.isArray(data.output) ? data.output[0] : null;
      return Response.json({ status: "succeeded", panelUrl });
    }

    if (status === "failed" || status === "canceled") {
      return Response.json({ status: "failed", panelUrl: null });
    }

    return Response.json({ status: status || "processing", panelUrl: null });
  } catch (error) {
    console.error("Panel poll error:", error);
    return Response.json({ status: "failed", panelUrl: null });
  }
}

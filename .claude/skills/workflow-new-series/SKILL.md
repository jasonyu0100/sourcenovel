---
name: workflow-new-series
description: Create a new series with full directory structure, writing module, direction module, and initial sources. Use when starting a brand new story series.
allowed-tools: Read, Write, Glob, Bash, AskUserQuestion
argument-hint: [--quick]
---

# Initialize New Series

See `_conventions.md` for shared patterns (discursive refinement, source loading, concept.md).

The user provides creative substance. The AI clarifies through follow-up questions and derives structure. Capture decisions progressively in concept.md. Arc creation is handled separately by `/workflow-new-arc`.

## Process Overview

```
Genre → Discursive Refinement → Proposal → Visual/Audio Style → Direction Style → Create Files → Publish
```

## Phase 1: Genre

Ask user's genre (Fantasy/Cultivation, Sci-Fi/Space Opera, Thriller/Mystery, Literary/Drama). Create `series/concepts/{concept-slug}/concept.md` with genre.

## Phase 2: Discursive Refinement

Concept.md lives at `series/concepts/{concept-slug}/concept.md` during refinement.

1. **Frame**: Explain the process — user controls pace, says "proceed" when ready
2. **Suggest 2-4 series concepts** via AskUserQuestion based on genre. Each: distinct premise + protagonist hint + hook
3. **If starting from scratch**: Ask open-ended — "Tell me about the series you want to create"
4. **Refine through follow-ups** — ask open-ended questions based on what they share:
   - Protagonist mentioned → past, drives, what makes them interesting?
   - Premise mentioned → what conflict, who's involved?
   - Setting mentioned → atmosphere, what makes it unique?
   - Uncertain → what stories/characters inspired you?
5. **When stalled**, use AskUserQuestion for navigation (Protagonist / World / Conflict / Tone). Adapt options — remove covered areas, add emerged ones.
6. **Update concept.md progressively** as sections solidify

Refinement must cover: protagonist, premise/conflict, setting, engagement hook.

Do NOT refine Arc 1 here — that's `/workflow-new-arc`.

**concept.md format:**
```markdown
# Series Concept
## Genre
## Protagonist
## Premise
## Setting
## Themes
## Engagement Hook
```

When user signals ready, synthesize and confirm before Phase 3.

## Phase 3: Proposal & Confirmation

Display proposal from concept.md:

```
TITLE OPTIONS: 1. "{Title}" - {why}  2. ...  3. ...
PROTAGONIST | PREMISE | SETTING | THEMES | HOOK
WRITING STYLE: POV, Tense, Distance, Rhythm, Target words/chapter
```

Ask: which title? Ready to create / adjust foundation / adjust style?

If adjustments needed, return to refinement for that area, update concept.md, re-render.

## Phase 4: Visual & Audio Style

Ask two questions:

1. **Visual aesthetic**: Cinematic Eastern Fantasy / Cinematic Western Fantasy / Sci-Fi Cinematic / Anime Epic / Dark Gothic
2. **Audio style**: Eastern Instrumental / Orchestral Epic / Synth-Orchestral Hybrid / Ambient Soundscape

**Infer remaining attributes** from genre, tone, and setting:
- Color temperature, saturation, lighting, mood, composition, visual references, anti-keywords

Update concept.md with choices. Generate `style.md` with:
- Core aesthetic description
- Base prompt keywords (for ALL image prompts)
- Color palette (primary, secondary, accents, grading)
- Lighting style keywords
- Mood keywords
- Cinematic techniques (composition, camera angles, depth)
- Art direction (characters, locations, elements)
- Anti-keywords
- Aspect ratios: 3:4 (reference images), variable (cinematic scenes)
- Film/art references
- Music style and character

## Phase 5: Direction Style

Ask questions about how the user wants their story told and how it should feel. This defines the visual storytelling philosophy for adapting prose into panels.

**Use AskUserQuestion to explore:**

1. **Pacing style**: How should the visual story breathe?
   - Dense and propulsive (action-forward, minimal pauses)
   - Balanced (mix of intensity and breathing room)
   - Contemplative (lingering moments, atmospheric panels)

2. **Emotional expression**: How should characters show feeling?
   - Subtle and restrained (composure default, cracks show through details)
   - Naturalistic (readable expressions, grounded in realism)
   - Expressive and dramatic (heightened emotion, bold reactions)

3. **Visual rhythm**: How should panels flow?
   - Cinematic (wide establishing shots, deliberate camera movement)
   - Dynamic (varied angles, energetic compositions)
   - Intimate (character-focused, close and personal)

4. **Tone emphasis**: What should the visual story prioritize?
   - Atmosphere and mood (environment carries emotion)
   - Character interiority (faces and body language dominate)
   - Action and spectacle (movement and scale)

5. **Silent storytelling**: How much should visuals carry without words?
   - Dialogue-driven (panels support the conversation)
   - Balanced (words and images share weight equally)
   - Visual-dominant (silence speaks, words are sparse)

**Follow-up based on responses:**
- If contemplative → ask about atmospheric influences, favorite quiet moments in stories
- If expressive → ask about emotional peaks they want to hit, character vulnerability
- If action-forward → ask about fight choreography style, tension-building preferences

**Update concept.md** with direction choices. Generate direction principles that will inform `modules/direction-module.md`.

## Phase 6: Create Files

**Re-read concept.md first.** Generate concrete content — no placeholders.

### Directory

```bash
mkdir -p series/{series-id}/{modules,sources,arcs,chapters,world/characters,world/locations,world/elements}
```

`{series-id}` derived from title (e.g., "The Dormant Bloodline" → `the-dormant-bloodline`). Concept stays in `series/concepts/` as audit trail.

### Files (relative to `series/{series-id}/`)

1. **`series.md`** — Expanded, comprehensive version of concept.md. Flesh out sparse areas with concrete invented details. Sections: Genre, Protagonist, Premise, Setting, Central Themes, Core Engagement Hook, Series Identity.
2. **`style.md`** — From Phase 4
3. **`modules/writing-module.md`** — Voice, style, vocabulary, structure. Include protagonist's actual name in lens. Series-specific terminology.
4. **`modules/direction-module.md`** — Visual storytelling philosophy from Phase 5. Defines how prose adapts to panels: pacing, expression style, visual rhythm, tone, silent storytelling principles. Include character-specific expression guidance and series-appropriate shot/composition defaults.
5. **`modules/interactive-module.md`** — Guides the interactive episode. Does NOT duplicate series.md (setting, power system, characters are injected separately via series/arc context). Focuses on:
   - **Narrator Identity**: Voice, relationship to player, emotional range
   - **Interaction Philosophy**: What actions matter (combat? politics? relationships?)
   - **Narrative Techniques**: How to describe outcomes, pacing, consequence ripples
   - **Choice Design**: Tactical vs emotional vs exploratory choices, brevity guidelines
   - **Character Dynamics**: How NPCs respond, power dynamics, what they reveal/withhold
   - **Series-Specific Patterns**: Unique interactions (using powers, political maneuvers, intimacy)

   Loaded at runtime into AI system prompt. Response format lives in API route.
6. **`sources/world.md`** — Named locations, organizations, magic/tech systems, world rules
7. **`sources/protagonist.md`** — Full name, age, appearance, background, personality, skills, wants/fears
8. **`world/index.md`** — Visual reference index (populated later by media workflow)
9. **`voices.md`** — TTS voice configuration for video narration. Map protagonist and any known characters to ElevenLabs voices. Use `.claude/skills/workflow-new-series/elevenlabs-voices.md` as reference for available voice IDs.

**voices.md format:**
```markdown
# Voices — {Series Title}

Voice configuration for TTS narration.

## Characters
- **{Protagonist}** — {voice_id} ({voice_name}) — {description matching character}

## Defaults
- **Female** — 21m00Tcm4TlvDq8ikWAM (Rachel) — calm, clear, professional
- **Male** — yoZ06aMxZJJ28mfd3POQ (Sam) — neutral, clear, versatile
```

Choose voices that match character personality: warm voices for empathetic characters, deep voices for authoritative ones, etc.

### Cover (3:4 portrait)

Artistic, symbolic — not literal portraits. Visual metaphors for central themes, dramatic composition, painterly quality.

**Template:** `{symbolic metaphor}, {atmosphere}, {composition}, {style.md lighting}, concept art, painterly, symbolic, {mood keywords}, book cover composition, {color palette}`

```bash
cd series/{series-id}
python ../.claude/skills/workflow-new-series/generate_cover.py cover.jpg "{cover_prompt}"
```

### Background (16:9 widescreen)

Cinematic environmental art — setting and mood, no characters. Establishing shots / matte paintings.

**Template:** `Cinematic panoramic {location}, {atmosphere}, {lighting}, {genre} environment, digital matte painting, epic scale, widescreen, {mood keywords}, {color palette}`

```bash
cd series/{series-id}
python ../.claude/skills/workflow-new-series/generate_background.py background.jpg "{background_prompt}"
```

## Phase 7: Publish

1. Ask user for author name, email, and donation link (optional).

2. Create `series/{series-id}/series.json` with series metadata:
   ```json
   {
     "title": "",
     "genre": "",
     "description": "",
     "author": { "name": "", "email": "" },
     "cover": "cover.jpg",
     "background": "background.jpg",
     "donationLink": ""
   }
   ```

   The `description` is the series hook — 1-2 sentences (max ~200 chars) that appear on the intro screen and series home page. It should make a reader want to click.

   **Writing the description:**
   - Source from `## Premise` in concept.md or series.md
   - Lead with the world's core tension or inciting condition (what makes this setting unique)
   - Follow with the protagonist's specific situation within that tension
   - Capture the central conflict, not a plot summary — the reader should feel stakes, not receive information
   - Use concrete, specific language over vague/generic ("a time-dilated sanctuary between rival superpowers" not "a dangerous world")
   - Match the tone of the series (literary for drama, punchy for action, evocative for romance)

3. Run `npm run sync` to detect the new series and regenerate `series/index.json`

## Quick Start (`--quick`)

1. Ask genre + one-sentence premise
2. AI generates full concept.md with reasonable defaults
3. User confirms
4. Create all files
5. → `/workflow-new-arc 1`

## Output

```
Series created: {series-id}

series/{series-id}/
├── series.json, series.md, style.md, voices.md, cover.jpg, background.jpg
├── modules/writing-module.md, direction-module.md, interactive-module.md
├── sources/protagonist.md, world.md
└── world/index.md

Next: /workflow-new-arc 1
```

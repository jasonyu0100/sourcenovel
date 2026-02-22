---
name: workflow-video
description: Generate chapter video from manga panels with TTS dialogue narration and background music.
allowed-tools: Read, Bash, Glob, Write
argument-hint: <chapter-number>
---

# Chapter Video

Generate narrated videos from manga panels: TTS dialogue over static images with background music. Two formats: desktop and mobile. Supports different voices per character.

## Arguments

- `$ARGUMENTS` - Chapter number (e.g., `3`)

## Prerequisites

- Pages must be complete: `chapters/{N}/pages/{P}/panels.json` + panel images + `page.jpg`
- ffmpeg installed, `ELEVEN_LABS_API_KEY` in .env
- **Voice config**: `voices.md` in series root (optional but recommended for multi-character stories)

## Process

### 1. Load & Verify

Scan `chapters/{N}/pages/` for page directories (1, 2, 3...). For each page, read `panels.json` to get:
- Panel image paths (prefer `-text.jpg` for dialogue panels, fall back to raw `.jpg`)
- Dialogue entries with speaker and text

Verify all panel images and `page.jpg` per page exist.

### 2. Load Voice Configuration

Read `voices.md` from the series root. This file maps characters to ElevenLabs voices in natural language:

```markdown
# Voices

## Characters
- **Sera** — EXAVITQu4vr4xnSDxMaL (Bella) — warm, commanding female voice
- **Idris** — IKne3meq5aSn9XLyUdCD (Charlie) — calm, thoughtful male voice

## Defaults
- **Female** — 21m00Tcm4TlvDq8ikWAM (Rachel) — calm, clear, professional
- **Male** — yoZ06aMxZJJ28mfd3POQ (Sam) — neutral, clear, versatile
```

If `voices.md` doesn't exist, create it using voice IDs from `.claude/skills/workflow-new-series/elevenlabs-voices.md` as reference.

### 3. Enrich panels.json for Video (REQUIRED)

**This step is critical for video quality.** Enrich each panels.json with voice mappings, dramatic timing, and sound effects. This makes panels.json the single source of truth for all video generation data.

#### 3a. Add Voice IDs to Dialogue

For each panel with `dialogue` entries:

1. Read `voices.md` to get character → voice_id mappings
2. Add `voice_id` to each dialogue entry in panels.json
3. If character not in voices.md, infer gender and use default voice

#### 3b. Add Dramatic Timing

Analyze the narrative and add timing fields to create emotional pacing:

- **`silence`**: Duration for silent panels (default: 1.0s)
  - Use 2.0-2.5s for establishing shots and scene transitions
  - Use 3.0-3.5s for dramatic reveals and emotional climaxes

- **`pause_after`**: Extra pause after dialogue (default: 0.3s)
  - Use 0.8-1.0s for impactful statements
  - Use 1.2-1.5s for emotional lines or confrontations
  - Use 2.0-2.5s for chapter-ending lines

#### 3c. Add Sound Effects (Strategic Use)

Sound effects enhance key moments. Use them selectively for emphasis — not on every panel.

##### When to Add SFX

| Moment Type | Example SFX |
|-------------|-------------|
| Emotional climax | Impact hit, tension release |
| Key transitions | Door latch, atmosphere shift |
| Establishing mood | Room ambience, city sounds |
| Physical actions | Footsteps, fabric movement |

**Maximum 1 SFX per page.** Choose the single most impactful moment on each page. Not every page needs sound.

##### SFX Description Style

Write descriptions that convey feeling:
- "quiet door latch clicking closed, metallic and final"
- "heavy emotional weight, muffled heartbeat"
- "cold electronic hum, warmth fading"

**Enriched panels.json example:**
```json
{
  "name": "establishing-wide",
  "prompt": "...",
  "ref": ["world/characters/protagonist.jpg"],
  "dialogue": [{
    "speaker": "Haruki",
    "voice_id": "ErXwobaYiN019PkySvjV",
    "text": "No power. No water. No food.",
    "placement": "upper right corner"
  }],
  "pause_after": 1.0
}
```

```json
{
  "name": "aperture-reveal",
  "prompt": "...",
  "silence": 3.0,
  "sfx": [{"description": "low ominous rumble with distant wind", "duration": 2.5}]
}
```

### 4. Generate Background Music

Check if `chapters/{N}/media/background-music.mp3` exists. If not, generate it:

1. Read `chapters/{N}/draft.md` and `style.md`
2. Analyze the chapter's emotional arc, atmosphere, and pacing
3. Craft a music prompt describing instrumentation, tempo, mood progression
4. Generate:

```bash
python .claude/skills/workflow-update-world/generate_media.py music series/{series-id} {chapter_num} "{music_prompt}" {duration_ms}
```

Default duration: 180000ms (3 minutes). Output: `chapters/{N}/media/background-music.mp3`

### 5. Generate TTS

Check if `chapters/{N}/media/tts-*.mp3` files already exist. If so, skip. Otherwise:

```bash
python .claude/skills/workflow-video/generate_video.py tts series/{series-id} {chapter_num}
```

Reads dialogue directly from panels.json and uses the `voice_id` field for each speaker. Saves `tts-1.mp3`, `tts-2.mp3`, etc.

### 5b. Generate Sound Effects

If any panels include `sfx` entries:

```bash
python .claude/skills/workflow-video/generate_video.py sfx series/{series-id} {chapter_num}
```

Reads `sfx` arrays from panels.json. Saves `sfx-1.mp3`, `sfx-2.mp3`, etc. Uses ElevenLabs Sound Generation API. Sound effects are mixed at 60% volume.

### 6. Assemble Both Videos

Generate **both** video formats in sequence (they reuse the same TTS and BGM):

#### Desktop — Horizontal (1920x1080)

```bash
python .claude/skills/workflow-video/generate_video.py desktop series/{series-id} {chapter_num}
```

- **Pages with dialogue**: Shows individual panel images, one per segment
- **Pages without dialogue**: Shows `page.jpg` for combined silence duration
- Aspect ratio preserved with black bars
- **Panels with dialogue**: `-text.jpg` image for TTS duration + padding
- **Output**: `chapters/{N}/media/chapter-video-desktop.mp4`

#### Mobile — Vertical / Shorts (1080x1920)

```bash
python .claude/skills/workflow-video/generate_video.py mobile series/{series-id} {chapter_num}
```

- Same logic as desktop but vertical format
- **Output**: `chapters/{N}/media/chapter-video-mobile.mp4`

Both share the same TTS narration and background music (25% volume, looped).

## Output

```
Video complete for Chapter {N}

BGM: media/background-music.mp3
TTS: media/tts-*.mp3
Desktop: media/chapter-video-desktop.mp4 (1920x1080)
Mobile: media/chapter-video-mobile.mp4 (1080x1920)

Next: /workflow-episode {N}
```

## Timing Guidelines

| Panel Type | Default | Dramatic |
|------------|---------|----------|
| Silent panel | 1.0s | 2.0-3.0s for reveals, transitions |
| Dialogue pause | 0.3s | 1.0-2.0s for impactful lines |
| SFX duration | 2.0s | 1.0-3.0s depending on effect |

## SFX Guidelines

Think cinematic — subtle, atmospheric sounds that enhance immersion:

**Good SFX (subtle, ambient):**
- Location atmosphere (airport hum, city ambience, room climate system)
- Soft mechanical sounds (door latches, elevator dings, pneumatic hiss)
- Human presence (footsteps on different surfaces, fabric rustle, breath)
- Emotional punctuation (heartbeat, distant thunder, wind)

**Avoid (harsh, abrasive):**
- Loud impacts or crashes
- Sharp electronic sounds
- Anything that jolts the viewer out of the scene

**Less is more.** Maximum 1 SFX per page. If in doubt, leave it out.

**To remove after generating:** delete the `sfx-N.mp3` file, remove the `sfx` entry from panels.json, regenerate video.

## BGM Guidelines

- **Follow style.md** — read the Music Style section for series-specific audio direction (vocals, instrumentation, character themes)
- **FAST START REQUIRED** — music must hook immediately from beat one. No slow intros, no gradual buildups. Start at full presence with vocals and instrumentation active from the opening. Explicitly state "starts at full intensity from the first beat, no intro" in prompts.
- **Match the emotion** — romantic scenes need passion (not melancholy), tense scenes need pressure (not sadness)
- **Prompt format:** `[Fast start instruction]. [style.md Music Style]. [Chapter emotional arc]. [Character-specific themes from style.md].`

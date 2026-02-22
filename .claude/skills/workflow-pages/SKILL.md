---
name: workflow-pages
description: Generate manga panel images from staging.md using Seedream with reference images for visual consistency.
allowed-tools: Read, Write, Glob, Bash
argument-hint: <chapter-number>
---

# Workflow Pages

Generate panel images from staging.md. This is the final step of the **Imagine Phase** — producing the actual visuals.

## Arguments

- `$ARGUMENTS` - Chapter number (e.g., `3`)

## Prerequisites

- `chapters/{N}/pages/staging.md` must exist
- Reference images must be generated (`/workflow-update-world` complete)

## Process

### 1. Load Context

Read:
- `chapters/{N}/pages/staging.md` — full panel prompts with layouts

### 2. Generate pages.json and panels.json

First, generate `chapters/{N}/pages/pages.json` — the page layout manifest used by `generate_pages.py batch`:

```json
[
  {"page": 1, "layout": "splash"},
  {"page": 2, "layout": "cinematic3"},
  {"page": 3, "layout": "story4"}
]
```

Fields per entry:
- `page` — page number
- `layout` — layout name from staging.md `**Layout:**` line

Then, for each page in `staging.md`, parse panels into JSON and save as `chapters/{N}/pages/{P}/panels.json`:

```json
[
  {
    "name": "establishing",
    "prompt": "anime manga style, ...",
    "ref": ["world/characters/idris.jpg", "world/locations/promenade-warm.jpg"],
    "dialogue": [{"speaker": "Sera", "text": "Where is he?"}]
  },
  ...
]
```

Fields per panel:
- `name` — slug from staging.md panel heading
- `prompt` — full prompt from `**Prompt:**` line
- `ref` — array of paths from `**Ref:**` line
- `dialogue` — array of `{"speaker": "...", "text": "..."}`. Omit if no dialogue
- `bubble` — descriptive placement guidance string. **Required if dialogue present**

**Bubble guidance (CRITICAL for correct speech bubble placement):**

The `bubble` field tells the text overlay system WHO is speaking and WHERE they are in the frame, so bubbles are placed correctly and don't cover faces.

```json
{
  "dialogue": [{"speaker": "Jace", "text": "Stay away from Rei Ashford."}],
  "bubble": "Speech from Jace, face fills frame center-bottom, place bubble TOP avoiding face"
}
```

```json
{
  "dialogue": [{"speaker": "Kade", "text": "She's not anyone's."}],
  "bubble": "Speech from Kade on LEFT facing Jace on RIGHT, place bubble TOP-LEFT with tail pointing left to Kade"
}
```

```json
{
  "dialogue": [{"speaker": "Nina", "text": "Shift handoff."}],
  "bubble": "Speech from Nina in doorway BACK of frame, place bubble TOP-CENTER with tail pointing down toward her"
}
```

| Shot Type | Bubble Guidance Pattern |
|-----------|------------------------|
| Close-up | `"Speech from [Name], face fills frame, place bubble TOP"` |
| Two-shot, speaker LEFT | `"Speech from [Name] on LEFT, bubble TOP-LEFT tail-left"` |
| Two-shot, speaker RIGHT | `"Speech from [Name] on RIGHT, bubble TOP-RIGHT tail-right"` |
| Speaker in background | `"Speech from [Name] at [location], bubble with tail toward them"` |

### 2.1 Dialogue Verification (CRITICAL)

**Before generating images, verify dialogue transfer:**

1. Count `**Dialogue:**` entries in `staging.md`
2. Count `"dialogue"` arrays in all `panels.json` files
3. **Counts must match**

If dialogue is in staging.md but missing from panels.json, add it:

```json
{
  "name": "assessment",
  "prompt": "Close-up on young woman with green hair...",
  "ref": ["world/characters/ivy-thornwood.jpg"],
  "dialogue": [{"speaker": "Ivy", "text": "Bold. Senna Vale wants you destroyed."}]
}
```

**Common failure:** Dialogue appears in model.md and staging.md but is omitted when generating panels.json. This results in panels without speech bubbles.

### 3. Generate Images

Use `batch` to generate all pages at once with maximum parallelism:

```bash
cd series/{series-id}
python ../../.claude/skills/workflow-pages/generate_pages.py batch chapters/{N}/pages
```

The batch command:
- Reads `pages.json` for page layouts
- Submits ALL raw panel predictions across ALL pages in parallel
- Then submits ALL text overlay predictions in parallel
- Composites each page after both passes complete
- Skips pages/panels that already have images (safe to re-run)

To regenerate a single page instead:

```bash
python ../../.claude/skills/workflow-pages/generate_pages.py generate \
  chapters/{N}/pages/{P} \
  {layout} \
  chapters/{N}/pages/{P}/panels.json
```

**Pipeline (Seedream 4.5):**
- **Pass 1 — Raw images:** Custom pixel dimensions per layout slot, parallel generation
- **Pass 2 — Text overlay:** For panels with dialogue, uses raw image as reference

**Output:**
```
chapters/{N}/pages/
├── pages.json                 # Page layout manifest
└── {P}/
    ├── panels.json
    ├── page.jpg               # Composited page
    ├── 1-{name}.jpg           # Raw panel
    ├── 1-{name}-text.jpg      # With speech bubbles (if dialogue)
    └── ...
```

### 4. Progressive Issue Tracking

Create `chapters/{N}/pages/issues.md` before starting generation. Update it as issues are found:

```markdown
# Chapter {N} Page Generation Issues

## Generation Log
- Started: {timestamp}
- Pages: {X}
- Panels: {Y}

## Content Flagged
| Page | Panel | Issue | Fix |
|------|-------|-------|-----|
| 5 | the-want | "sexual" flagged | Removed suggestive language |

## Visual Quality Issues
| Page | Panel | Problem | Status |
|------|-------|---------|--------|
| 13 | tangling | Literal interpretation | Fixed: changed to "auras radiating" |
| 16 | effects | Random characters in abstract | Fixed: added "No figures visible" |

## Resolved
- [x] P5: Revised prompt, regenerated
- [x] P13: Changed metaphor to visual description
```

### 5. Review and Regenerate

**Review PROGRESSIVELY** — check pages as they generate, don't wait until the end.

Check each `page.jpg` for:
1. **Content flagging** — API rejected the prompt (check terminal output)
2. **White/blank backgrounds** — text overlay replaced scene
3. **Expression changes** — face differs from raw image
4. **Background inconsistency** — atmosphere mismatch
5. **Hallucinated text on raw images** — raw `.jpg` files should have NO text
6. **Repeating patterns in tall slots** — extreme close-ups tile in vertical layouts
7. **Literal interpretation** — metaphorical language rendered as objects
8. **Random characters in abstract panels** — figures appearing where none should be

**Common fixes:**

| Issue | Fix |
|-------|-----|
| Content flagged (sexual) | Remove suggestive language: "sensual" → "relaxed", "desire" → "warmth" |
| Content flagged (violence) | Soften: "wants you dead" → "wants you destroyed" |
| Random characters in effects | Add "No figures visible" or "Abstract effects panel" |
| Literal threads/strings | Change metaphor: "threads connecting" → "auras radiating" |
| Character merged into environment | Clarify position: "standing against wall, observing" |
| Wrong composition in strip4 | Use wide horizontal framing, not portrait composition |

**Process:**
1. Log issue in `issues.md`
2. Delete problematic image(s)
3. Update prompt in `panels.json`
4. Re-run `batch` (skips existing images)
5. Mark resolved in `issues.md`

### 5. Sync

```bash
npm run sync
```

### 6. Update meta.json

Set `steps.pages.completed = true`.

## Output

```
Pages complete for Chapter {N}

Pages: {X}
Panels: {Y}
Issues resolved: {Z}

Files:
  └── pages/issues.md (generation log)
  └── pages/{P}/page.jpg + individual panels

Next: /workflow-video {N}
```

## Selective Regeneration

**CRITICAL: When updating panels.json, you MUST delete the corresponding images.**

The batch command skips existing images. If you change a prompt, dialogue, or bubble guidance in `panels.json` but don't delete the image, your changes won't take effect.

**Workflow for updates:**
1. Edit `panels.json` with new prompt/dialogue/bubble
2. **Delete the affected images** (raw + text variants)
3. Run `batch` to regenerate only the deleted images
4. Verify changes applied correctly

**What to delete:**

| Change Made | Files to Delete |
|-------------|-----------------|
| Prompt changed | `{N}-{name}.jpg` + `{N}-{name}-text.jpg` + `page.jpg` |
| Dialogue added/changed | `{N}-{name}-text.jpg` + `page.jpg` |
| Bubble guidance changed | `{N}-{name}-text.jpg` + `page.jpg` |
| Panel removed/reordered | All panel images + `page.jpg` |

**Delete commands:**
```bash
# Single panel (prompt changed)
rm chapters/2/pages/5/3-eyes-meet*.jpg chapters/2/pages/5/page.jpg

# Multiple panels on a page
rm chapters/2/pages/12/*.jpg

# Text overlay only (dialogue/bubble changed)
rm chapters/2/pages/5/3-eyes-meet-text.jpg chapters/2/pages/5/page.jpg
```

**Common mistake:** Updating panels.json and running batch without deleting images — nothing regenerates because images already exist.

## Recompositing

After replacing panel images, recomposite without regenerating:

```bash
python .claude/skills/workflow-pages/generate_pages.py composite \
  chapters/{N}/pages/{P} \
  {layout} \
  chapters/{N}/pages/{P}/panels.json
```

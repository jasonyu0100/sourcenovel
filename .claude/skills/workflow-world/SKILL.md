---
name: workflow-world
description: Scan chapter for new visual elements, create world entries, generate reference images, update world index.
allowed-tools: Read, Write, Glob, Bash
argument-hint: <chapter-number>
---

# World

Scan a chapter draft for new visual elements, create world entries, and generate reference images for visual consistency across manga pages.

## Arguments

- `$ARGUMENTS` - Chapter number (e.g., `3`)

## Prerequisites

- `workflow-set` must be done (set.md exists with visual direction)

## Process

### 1. Load Context

Read `chapters/{N}/meta.json` to get the `arcId`.

Read:

- `style.md` — visual style keywords (MUST apply to all prompts)
- `chapters/{N}/draft.md` — chapter content to scan
- `sources/*.md` — general source material (protagonist bios, world-building)
- `sources/{arcId}/*.md` — arc-specific sources (characters, setting)
- `world/index.md` — existing world entries
- Glob `world/{characters,locations,elements}/*.md` — existing entry files

### 2. Update World Entries

Scan the chapter draft and sources for world entries. This step both **creates new entries** and **enhances existing entries** with lore revealed in this chapter.

**New entries:** Create `world/{category}/{slug}.md` for any character, location, or element in the chapter not yet in `world/`. Use sources to enrich with lore.

**Existing entries:** Check if the chapter reveals new lore (connections, backstory, significance) for existing entries. If so, update the `.md` file — add or expand the lore section while preserving prompt keywords.

Entry format:

```markdown
# Entry Name

Lore — narrative significance, connections, backstory, what this entry means to the story.

Visual description — physical/visual details for reference image generation.

\`\`\`
prompt keywords for image generation
\`\`\`
```

**IMPORTANT — Style Consistency:**

- All prompts MUST include style.md base keywords
- Maintain the series aesthetic defined in style.md
- For creatures/monsters: emphasize uniqueness and visual interest

Categories:

- **characters/** — lore: connections, personality, powers, arc state. Visual: physical appearance, clothing, distinguishing features.
- **locations/** — lore: narrative significance, what happens here, atmosphere. Visual: architecture, lighting, environment.
- **elements/** — lore: origin, symbolism, narrative function. Visual: physical description, materials, shape.

Update `world/index.md` to include any new entries.

### 3. Generate Reference Images

Check which entries in `world/{characters,locations,elements}/` are missing a corresponding `.jpg` file. For each missing reference:

1. Read the entry's `.md` file and extract prompt keywords from the code fence
2. Combine with `style.md` base keywords (REQUIRED)
3. Choose appropriate aspect ratio based on subject shape:

**Aspect Ratio Guidelines:**

| Category | Default | When to Use Different |
|----------|---------|----------------------|
| **Characters** | `3:4` (portrait) | Use `1:1` for busts, `2:3` for full-body |
| **Locations** | `16:9` (cinematic) | Use `4:3` for interiors, `21:9` for panoramas |
| **Elements** | `1:1` (detail) | **Match the object's natural shape** |

**Elements — Shape-Based Aspect Ratios:**

| Object Type | Aspect Ratio | Examples |
|-------------|--------------|----------|
| Long horizontal | `16:9` or `21:9` | Swords, staffs, rifles, scrolls |
| Long vertical | `9:16` | Spears, poles, banners |
| Square-ish | `1:1` | Medallions, orbs, masks, books |
| Wide objects | `4:3` or `3:2` | Chests, vehicles, altars |
| Tall objects | `3:4` or `2:3` | Statues, doors, shields |

**Important:** For weapons like katanas, use `16:9` or `21:9` to capture the full blade without awkward cropping. The reference should show the object in its natural orientation.

**Location Notes:**
- **NO characters or figures** in location prompts — these are clean backgrounds for compositing
- For **trails/paths**, describe as "narrow mountain trail" or "dirt footpath" — avoid "road" which implies vehicle roads

Generate using the **world** command (saves directly to world/ directory):

```bash
python .claude/skills/workflow-world/generate_media.py world series/{series-id} '{images_json}'
```

**images_json format:**

```json
[
  {
    "name": "characters/protagonist-name",
    "prompt": "character description + style.md keywords",
    "aspect_ratio": "3:4"
  },
  {
    "name": "locations/location-name",
    "prompt": "location description + style.md keywords",
    "aspect_ratio": "16:9"
  },
  {
    "name": "elements/katana-blade",
    "prompt": "katana laid horizontal, full blade visible + style.md keywords",
    "aspect_ratio": "21:9"
  }
]
```

Images save to `world/{category}/{slug}.jpg` alongside their `.md` files.

### 4. Update Index

Update `world/index.md` to add `(ref)` marker after entries that now have images:

```markdown
## Characters

- [Protagonist](characters/protagonist.md) (ref) — Brief visual description

## Locations

- [Dark Corridor](locations/dark-corridor.md) (ref) — Brief visual description

## Elements

- [The Creature](elements/creature.md) (ref) — Brief visual description
```

## Output

```
World updated for Chapter {N}

New entries: {count}
  - world/characters/{slug}.md
  - world/locations/{slug}.md
  - world/elements/{slug}.md
Enhanced entries: {count}
  - world/characters/{slug}.md (added lore)
  - world/locations/{slug}.md (added lore)
References generated: {count} new images
  - world/characters/{slug}.jpg
  - world/locations/{slug}.jpg
  - world/elements/{slug}.jpg
Skipped: {count} (already had references)

Next: /workflow-staging {N}
```

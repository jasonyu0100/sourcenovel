---
name: workflow-episode
description: Generate episode.json for a chapter with character, location, and story references for the interactive episode. Run after pages are generated.
allowed-tools: Read, Write, Glob, Bash
argument-hint: <chapter-number>
---

# Generate Episode Data

Create `episode.json` for a chapter by scanning panels.json files and world data to extract all episode references.

## Arguments

- `$ARGUMENTS` - Chapter number

## Prerequisites

- Pages must be generated (`panels.json` files exist in `series/{series-id}/chapters/{N}/pages/*/`)

## Process

Run the generation script from the project root:

```bash
python .claude/skills/workflow-episode/generate_episode.py series/{series-id} {chapter_num}
```

The script automatically:
1. Reads `meta.json` for arc number
2. Scans all `panels.json` files across every page in `series/{series-id}/chapters/{N}/pages/*/`
3. Extracts unique character refs, location refs, and speaker names
4. Determines default character (most dialogue lines + panel appearances)
5. Finds starting location (first location ref in page/panel order)
6. Writes `episode.json` to `series/{series-id}/chapters/{N}/episode.json`

## Output Schema

```json
{
  "chapterNum": 1,
  "arcNum": 1,
  "defaultCharacter": "Kade",
  "startingLocation": "infirmary",
  "characters": [
    {
      "name": "Kade Morrow",
      "slug": "kade-morrow"
    }
  ],
  "locations": [
    {
      "name": "Infirmary",
      "slug": "infirmary"
    }
  ]
}
```

### Field Reference

- **chapterNum** — Chapter number
- **arcNum** — Arc number this chapter belongs to (read from meta.json, default to 1)
- **defaultCharacter** — The suggested playable character (most prominent in the chapter)
- **startingLocation** — Slug of the first location ref (fallback for interactive mode)
- **characters[]** — Every character who appears in the chapter
  - `name` — Display name (proper case)
  - `slug` — Filename slug (lowercase, hyphenated)
- **locations[]** — Every location backdrop used in the chapter
  - `name` — Display name (proper case, spaces)
  - `slug` — Filename slug

## Guidelines

- Character names from `dialogue[].speaker` may differ from slugs (e.g. "Maren" vs "maren-caul"). Match by checking if the speaker name is a prefix of any known character slug.
- Location variations (e.g. `quarters-wide-couch`, `quarters-window`, `quarters-cool`) are separate entries.

## Output

```
EPISODE DATA GENERATED: Chapter {N}
Characters: {names}
Locations: {names}
File: series/{series-id}/chapters/{N}/episode.json

Next: /workflow-complete {N}
```

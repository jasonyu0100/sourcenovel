---
name: workflow-set
description: Design the production set — locations, costumes, props, and prompt guidance for visual consistency.
allowed-tools: Read, Write, Glob
argument-hint: <chapter-number>
---

# Workflow Set

Design the production set from the script. This is the second step of the **Imagine Phase** — defining visual elements for consistency before generating reference images.

## Arguments

- `$ARGUMENTS` - Chapter number (e.g., `3`)

## Prerequisites

- `chapters/{N}/pages/model.md` must exist
- `modules/direction-module.md` should exist

## Process

### 1. Load Context

Read:
- `chapters/{N}/pages/model.md` — to see what appears and how
- `modules/direction-module.md` — visual storytelling principles and consistency guidelines
- `world/characters/*.md` — existing character descriptions
- `world/locations/*.md` — existing location descriptions
- `style.md` — visual style keywords

### 2. Identify Set Elements

From the script, identify:
- **Locations** — Where scenes take place
- **Costumes** — What characters wear (especially if different from default)
- **Props** — Objects that appear and need visual consistency
- **Atmosphere** — Lighting, weather, mood elements

### 3. Write set.md

Create `chapters/{N}/pages/set.md` — comprehensive set design document:

```markdown
# Chapter {N} Set Design

## Locations

### {Location Name}
Base: {Core visual elements, atmosphere, key features}

#### Views (generate as refs)
**IMPORTANT: Location refs are clean backgrounds — NO characters or figures.**

1. **{slug}-primary**
   Main establishing view — the default angle for this location

2. **{slug}-secondary** (optional)
   Alternate view if needed for specific scenes (different angle or lighting)

---

## Costumes

### {Character} — {Scene/Context}
Outfit: {Description of what they're wearing in this chapter}
Details: {Specific elements — collar style, fabric, tech accents}
Variations: {If costume changes, note when}
Prompt guidance: "dark mandarin collar suit with clean lines, slightly creased from earlier mission"

---

## Props & Objects

### {Object Name}
Description: {Visual description for prompt consistency}
Appears in: {Which scenes/beats}
Prompt guidance: "{exact phrase to use in prompts}"

---

## Persistent Elements

### Lighting Signature
- Warm: {Source and color}
- Cool: {Source and color}
- Split: {How they combine}

### Atmosphere
- {Atmospheric elements that persist}
- {Visual motifs}

### Sound Cues (for later video)
- {Ambient sounds}
- {Key sound effects}
```

### 4. Apply Consistency Hierarchy

| Element | Reference Image? | Prompt Guidance? |
|---------|-----------------|------------------|
| Main characters | Yes (existing) | Yes (costume details) |
| Locations | Yes (1-2 views) | Yes (atmosphere) |
| Key props (weapons, vehicles) | Maybe | Yes |
| Minor props (glasses, datapads) | No | Yes |
| Lighting/atmosphere | No | Yes |

**Refs are the first line of consistency.** Generate refs for things that appear repeatedly and need visual anchoring.

**Prompt guidance is the second line.** For things without refs (a champagne glass, a notification glow), write exact prompt phrases to copy into staging.md.

### 5. Location View Guidelines

- **All location refs are clean backgrounds — no characters or figures**
- **1-2 views per location** — primary view required, secondary only if needed
- Primary view: main establishing angle that defines the space
- Secondary view: only add if scenes require a distinctly different angle or lighting
- Don't over-generate — each ref should serve a clear purpose

### 6. Update meta.json

Set `steps.set.completed = true` and record variation counts.

## Output

```
Set design complete for Chapter {N}

Locations: {X} ({Y} views)
Costumes: {Z} entries
Props: {W} entries

Files:
  └── pages/set.md

Next: /workflow-world {N}
```

## Handoff to Update World

After set.md is complete, `/workflow-update-world` will:
1. Read set.md
2. Generate reference images for location variations
3. Generate reference images for any new costumes/props marked for refs
4. Save to `world/locations/`, `world/elements/`

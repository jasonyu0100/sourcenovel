---
name: workflow-new-arc
description: Create a new arc with definition, sources, and engagement formula. Uses discursive refinement to develop arc direction.
allowed-tools: Read, Write, Glob, Grep, AskUserQuestion
argument-hint: [arc-number]
---

# Create New Arc

See `_conventions.md` for shared patterns (discursive refinement, concept.md).

## Arguments

- `$ARGUMENTS` - Optional arc number (defaults to next arc)

## Process

### 1. Gather Context

1. Determine arc number (scan `arcs/*/` or use argument)
2. Load context:
   - **Arc 1**: Read `series.md`, `sources/protagonist.md`, `sources/world.md`
   - **Arc 2+**: Read `arcs/{prev}/arc.md`, `sources/{prev}/*.md`, recent chapter web.md files
3. Read previous arc's `formula.md` to avoid technique repetition
4. Create `arcs/{N}/`

### 2. Discursive Refinement

Suggest 2-4 directions based on open threads and character states. Refine through AskUserQuestion covering: transition, tone shift, central conflict, character focus, new elements. Update concept.md progressively.

### 3. Proposal & Confirmation

Synthesize concept.md into proposal. Confirm with user before creating files.

```
ARC {N}: {Title}
TRANSITION | TONE | CENTRAL CONFLICT | CHARACTER FOCUS
BEATS: 1. {name} - {desc} ...
ENGAGEMENT: {techniques}
```

### 4. Create Files

**Re-read concept.md**, then generate:

1. `arcs/{N}/arc.md` — premise, goals, beats, characters
2. `arcs/{N}/formula.md` — engagement techniques (fresh, not repeated from previous arc)
3. `sources/{N}/characters.md` — continuing + new characters
4. `sources/{N}/setting.md` — locations and sensory palette

## Output

```
ARC {N} CREATED: {Title}
Files: arcs/{N}/concept.md, arc.md, formula.md | sources/{N}/characters.md, setting.md
Next: /workflow-new-chapter {next-chapter}
```

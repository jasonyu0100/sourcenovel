---
name: workflow-compose
description: Generate full chapter prose from the semantic route. Uses the writing module to apply consistent style. Use after /workflow-route is finalized.
allowed-tools: Read, Write, Glob
argument-hint: [style notes]
---

# Compose Chapter Text

Generate full prose from the semantic route, applying the writing module's style.

## Arguments

- `$ARGUMENTS` - Optional style notes (e.g., "More introspective", "Faster pacing")

## Prerequisites

- `route.completed = true` in meta.json

## Process

1. **Load inputs**: concept.md, memory.md, route.md, `modules/writing-module.md`, `arcs/{arc}/formula.md`
   - If writing module doesn't exist, ask user to run `/workflow-new-series` first

2. **Apply writing module**: Voice (POV, tense, distance), Style (rhythm, density, dialogue), Vocabulary (register, avoids), Structure (target length, scene breaks, opening/closing patterns)

3. **Generate title** from route header (`# Chapter {N} Route: [Title]`):
   - Extract the title portion after "Route:" (e.g., "The Transit")
   - Format as `# {Title}` (just the title, no "Chapter N" prefix)
   - Example: route header `# Chapter 6 Route: The Transit` → draft header `# The Transit`

4. **Generate prose** — for each route node:
   - Expand to full prose with voice/style consistency
   - Incorporate memory details, smooth transitions
   - No meta-references ("Chapter N") — use diegetic references

5. **Verify against concept**: direction realized, scope respected, engagement delivered (key moment lands, tension present, technique demonstrated)

6. **Save** to `chapters/{N}/draft.md`. Update meta.json: `compose.completed = true`, set `wordCount`.

7. **Proceed** to `/workflow-review` automatically.

## Output

```
DRAFT COMPOSED: Chapter {N} — "{Title}"
Words: {wordCount} | Nodes: {X} expanded
Files: └── chapters/{N}/draft.md
Next: /workflow-review
```

---
name: workflow-route
description: Create a semantic route for the chapter. A route is a sequence of narrative nodes describing what happens beat by beat. Use after /workflow-memory.
allowed-tools: Read, Write, Glob
---

# Create Semantic Route

Generate concise, information-dense narrative nodes outlining the chapter's flow. Routes are NOT prose — they are compressed blueprints that expand during Compose.

## Prerequisites

- `memory.completed = true` in meta.json

## Node Structure

Each node: 2-3 sentences. `[What happens] + [Character's reaction] + [Unresolved thread]`

## Process

1. Read concept.md, memory.md, `arcs/{arc}/formula.md`
2. Generate nodes covering the concept:
   - Apply formula directly (tension placement, pacing)
   - Include concept's key moment
   - Follow opening hook → momentum → closing pull
   - Respect the formula's Avoid list
3. Save to `chapters/{N}/route.md`, update meta.json: `route.completed = true`

## Node-to-Word Calibration

Each node → ~100-200 words of prose. Check `modules/writing-module.md` for target length.

| Target Words | Nodes |
|---|---|
| 1,500-2,000 | 8-12 |
| 2,000-2,500 | 10-15 |
| 2,500-3,500 | 12-18 |
| 3,500-4,500 | 18-25 |

Action nodes expand less (~100w), introspective nodes more (~200w).

## Format

```markdown
# Chapter {N} Route: [Title]

[2-3 sentences for node 1]

[2-3 sentences for node 2]

...
```

Nodes separated by blank lines. No headers or numbering.

## Output

```
ROUTE CREATED: Chapter {N} — "{Title}"
Nodes: {X} beats
Files: └── chapters/{N}/route.md
Next: /workflow-compose
```

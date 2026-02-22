---
name: workflow-web
description: Generate web.md tree structure for web reader. Use after /workflow-review.
allowed-tools: Read, Write
argument-hint: <chapter-number>
---

# Generate Web Data

Create `web.md` from route and draft for the interactive web reader.

## Arguments

- `$ARGUMENTS` - Chapter number

## Process

1. Read `chapters/{N}/route.md` and `chapters/{N}/draft.md`
2. Build tree: major beats from route → `##`, related moments → `###`, extract quotes from draft
3. Write to `series/{series-id}/chapters/{N}/web.md`
4. Update `meta.json`: `web.completed = true`

## Format

```markdown
---
title: Chapter Title
subtitle: Brief description
---

# Overview
Chapter summary.
> Thematic context.

## Major Beat
Description of what happens.
> Commentary: character state, motivation, or thematic weight.
"Quoted prose from draft."

### Sub-moment
What specifically occurs.
> Why this matters — character insight, plot significance, thematic resonance.
"Key quote."
```

## Structure

- `#` (depth 0) = overview | `##` (depth 1) = major beats | `###` (depth 2) = moments | `####` (depth 3) = details | `#####` (depth 4) = micro-details
- First paragraph = description (what happens)
- Blockquote = commentary (why it matters)
- Quoted text = prose excerpt from draft

## Depth

**Vary based on narrative density.** Deep (3-4 levels) for: multiple revelations, significant character change, key worldbuilding, thematic moments, multi-phase action. Shallow (1-2) for: transitions, simple actions, setup.

**Avoid flat trees** — if every `##` has exactly one `###`, collapse or expand.

## Commentary

Every blockquote must provide genuine insight — character state, narrative significance, or context useful for later reference.

Bad: `> The gate tests him.`
Good: `> The gate requires absence of approach — echoing the paradox of transformation without theory.`

## Guidelines

- Labels: 2-4 words, evocative
- Descriptions: 1-2 sentences
- Commentary: 1-3 sentences with context and significance
- **~20 nodes per chapter**, average depth 2-2.5
- **Consolidate** related moments into single nodes rather than creating separate entries for the same idea

## Output

```
WEB GENERATED: Chapter {N}
Nodes: {X} | Avg depth: {avg}
Files: └── series/{series-id}/chapters/{N}/web.md
Next: /workflow-model {N} (visual phase) or /workflow-complete {N} (text-only)
```

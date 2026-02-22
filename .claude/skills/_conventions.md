# Shared Workflow Conventions

Referenced by individual skill files. Do not duplicate these patterns — just reference this file.

## Source Loading

1. **General sources**: Glob `sources/*.md` (NOT subdirectories). Read ALL files found.
2. **Arc-specific sources**: Glob `sources/{arcId}/*.md`. Read ALL files found. Do NOT read other arc directories.
3. **Arc definition**: Read `arcs/{arcId}/arc.md`

## Discursive Refinement

Used by new-series, new-chapter, new-arc. Core rules:

1. **User controls pace** — refinement continues until user says "proceed" / "move on" / similar. AI never decides when refinement is done.
2. **Build on their words** — use their language and ideas, don't replace with templates
3. **Capture as you go** — update concept.md after each decision solidifies, not at the end. Briefly acknowledge: "I've captured that in the record."
4. **Cover all bases** — by end, the required dimensions (varies by skill) must be addressed
5. **Concrete over abstract** — name specific characters, places, events. No placeholders.
6. **Suggest 2-4 directions** via AskUserQuestion as starting points, then refine through follow-ups
7. **Never skip refinement** — even after picking a direction, always ask at least one follow-up

## Meta.json

- Read meta.json to check step prerequisites (`{step}.completed = true`)
- After completing a step, set `{step}.completed = true` with timestamp in meta.json
- Never clear meta.json during resets — only update step completion flags

## Concept.md

- Permanent audit trail — never delete, only edit
- Progressive: sections fill in as conversation progresses
- Lives in chapter or concept directory during refinement

## Step Order

```
concept → memory → route → compose → review → web → complete
```

## Output Convention

Every skill ends with a status block showing: what was created, key stats, file paths, and `Next: /workflow-{next-step}`.

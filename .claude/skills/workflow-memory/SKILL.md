---
name: workflow-memory
description: Build chapter memory from sources and previous chapters. Use after /workflow-new-chapter.
allowed-tools: Read, Write, Glob
argument-hint: [focus topics]
---

# Build Chapter Memory

Gather context from sources and previous chapters for the current chapter.

## Arguments

- `$ARGUMENTS` - Optional focus topics (e.g., "character relationships", "world-building")

## Prerequisites

- `concept.completed = true` in meta.json

## Process

1. **Load concept**: Read `chapters/{N}/concept.md`, note `arcId` from meta.json
2. **Gather sources** per `_conventions.md` (general + arc-specific + arc definition)
3. **Gather previous chapters**: Read each `series/{series-id}/chapters/*/web.md` (NOT full drafts). Extract events, character states, unresolved threads, callback opportunities.
4. **Build memory**:
   - **Short-Term** (last 2-3 chapters): scene detail, exact dialogue for callbacks, character emotional states, unresolved threads
   - **Long-Term** (earlier): key plot events, development milestones, worldbuilding facts, setups awaiting payoff, motifs
5. **Write** `chapters/{N}/memory.md`, update meta.json: `memory.completed = true`

## Memory Format

```markdown
# Chapter {N} Memory

## Concept
[Brief restatement of direction, key scene, engagement]

## Sources
### General
### Arc {N}
### Arc Definition

## Short-Term Memory
### Chapter {N-1}: [Title]
- Events | Character State | Unresolved | Key Quote

## Long-Term Memory
### Key Events
### Setups Awaiting Payoff
### Recurring Elements

## Key Elements
### Must Include
### Callbacks
```

## Output

```
MEMORY BUILT: Chapter {N}
Sources: {X} general, {Y} arc-specific | Chapters: {A} short-term, {B} long-term
Files: └── chapters/{N}/memory.md
Next: /workflow-route
```

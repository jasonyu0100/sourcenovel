---
name: workflow-new-chapter
description: Create a new chapter with directory structure and objective. Offers selection or discursive refinement to develop the chapter direction. Use when starting work on a new chapter.
allowed-tools: Read, Write, Glob, Bash, AskUserQuestion
argument-hint: [chapter-number] or [chapter-number "direction hint"]
---

# Create New Chapter

See `_conventions.md` for shared patterns (discursive refinement, source loading, concept.md).

Chapter direction is about **immediate transitions** — what happens next given where we are. Focus on which thread to pull, what scene advances the story, and how to deliver on the engagement formula.

## Arguments

- `$ARGUMENTS` - Chapter number, optionally followed by direction hint
  - `5` — ask for direction
  - `5 "Focus on the confrontation with Marcus"` — use hint as starting concept

## Process

### 1. Setup

1. Verify series directory exists (else → `/workflow-new-series`)
2. Create `chapters/{chapter-num}/`
3. Create `meta.json`:
   ```json
   {
     "chapterNumber": N, "arcId": "current-arc", "status": "initialized", "wordCount": null,
     "steps": {
       "concept": {}, "memory": {}, "route": {}, "compose": {}, "review": {}, "web": {},
       "model": {}, "set": {}, "world": {}, "staging": {}, "pages": {}, "video": {},
       "episode": {}, "complete": {}
     }
   }
   ```
   Each step: `{ "completed": false, "timestamp": null }`

   **Workflow phases:**
   - **Text phase** (concept → web): Writing the chapter prose and web reader structure
   - **Visual phase** (model → video): Creating manga panels and video — *optional, can be skipped*
   - **Integration phase** (episode → complete): Interactive episode and finalization

   After `web` is complete, users can skip directly to `/workflow-complete` for text-only output. The visual phase (model → video) and episode step are optional. The `world` step updates the world directory with new visual elements after the set is created.

4. Create placeholder files: `concept.md`, `memory.md`, `route.md`, `draft.md`, `review.md`, `web.md`

### 2. Load Context

1. Read `arcs/{arc}/arc.md` and `arcs/{arc}/formula.md`
2. Load sources per `_conventions.md` (general + arc-specific)
3. Read last 2-3 chapter web.md files for threads and momentum
4. Analyze: arc beat position, active threads, unused engagement techniques, relevant character details

### 3. Discursive Refinement

If direction hint provided, write to concept.md and ask if user wants to refine or proceed.

1. **Frame**: Explain the process — user controls pace
2. **Suggest 2-4 directions** via AskUserQuestion. Each references specific threads, characters, and engagement techniques.
3. **If from scratch**: Share reading of situation (threads, next beat, techniques) and ask what interests them
4. **Refine through AskUserQuestion** — one dimension at a time:
   - Key scene (central moment)
   - Character approach (how they handle it)
   - Tension source (what creates stakes)
   - Scope (single scene / hours / day / time skip)
5. **Update concept.md progressively** as decisions solidify

Refinement must cover: direction, thread, engagement technique, tension, scope.

**concept.md format:**
```markdown
# Chapter {N} Concept
## Active Threads
## Direction
## Key Scene
## Thread
## Engagement
- Technique: | Tension: | Key Moment:
## Scope
- Location: | Timeframe: | Focus: {revelation|action|dialogue|introspection}
```

When user signals ready, summarize and confirm. On confirmation, mark `concept.completed = true` and proceed to `/workflow-memory`.

## Output

```
CHAPTER {N} CREATED: {Direction summary}

Files:
├── chapters/{N}/meta.json
└── chapters/{N}/concept.md

Next: /workflow-memory
```

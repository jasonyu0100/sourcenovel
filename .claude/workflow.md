# Workflow

Auto-progressing pipeline for generating novel chapters. Each step proceeds to the next automatically. User input required for: `/workflow-new-series`, `/workflow-new-chapter`, `/workflow-new-arc`. Reset any step via `/workflow-reset`.

## Full Pipeline

```
concept → memory → route → compose → review → web
                             ↑         |
                             └─rewrite─┘
                                       ↓
model → set → world → staging → pages → video → episode → complete
```

## Three Phases

**TEXT PHASE** — Writing
```
Concept → Memory → Route → Compose → Review → Web
```
After `web` is complete, you can skip to `episode` for text-only output.

**VISUAL PHASE** — Manga Production *(optional)*
```
Model → Set → World → Staging → Pages → Video
(spatial) (design) (refs)  (prompts)  (images) (final)
```

**INTEGRATION PHASE** — Finalization
```
Episode → Complete
```

## Directory Structure

```
series/{series-id}/
├── series.md, style.md
├── modules/
│   ├── writing-module.md        # Prose style guide
│   └── direction-module.md      # Visual storytelling guide
├── sources/                     # *.md (general) + {arc-num}/*.md (arc-specific)
├── arcs/{arc-num}/              # concept.md, arc.md, formula.md
├── chapters/{chapter-num}/
│   ├── concept.md               # Direction (discursive history)
│   ├── memory.md, route.md, draft.md, review.md, web.md
│   ├── meta.json
│   ├── media/                   # background-music.mp3, chapter-video-*.mp4
│   └── pages/
│       ├── model.md             # Spatial model (positions + beats)
│       ├── set.md               # Set design (locations, costumes, props)
│       ├── staging.md           # Full panel prompts
│       └── {P}/                 # page.jpg + individual panel images
└── world/                       # index.md + characters/, locations/, elements/
                                 # Each entry: {slug}.md + {slug}.jpg (reference)
```

## Text Phase — Writing

| Step | Skill | Input | Output |
|---|---|---|---|
| 1 | `/workflow-new-chapter` | arc context, sources, previous chapters | concept.md |
| 2 | `/workflow-memory` | concept.md, sources, previous web.md files | memory.md |
| 3 | `/workflow-route` | concept.md, memory.md, formula.md | route.md (8-15 nodes) |
| 4 | `/workflow-compose` | route.md, memory.md, writing-module.md | draft.md |
| 5 | `/workflow-review` | draft.md vs route.md + memory.md | review.md (PASS/REVISE) |
| 6 | `/workflow-web` | route.md + draft.md | web.md (hierarchical tree) |

After web: proceed to `/workflow-model` for visual production, or skip to `/workflow-complete` for text-only.

## Visual Phase — Manga Production *(optional)*

| Step | Skill | Input | Output |
|---|---|---|---|
| 7 | `/workflow-model` | draft.md + direction-module.md | model.md (positions + beats) |
| 8 | `/workflow-set` | model.md | set.md (locations, costumes, props) |
| 9 | `/workflow-world` | set.md + style.md | world refs (characters, locations, elements) |
| 10 | `/workflow-staging` | model.md + set.md + world refs | staging.md (panel prompts) |
| 11 | `/workflow-pages` | staging.md | panels.json + page images |
| 12 | `/workflow-video` | pages + panels.json + draft.md | BGM, TTS, chapter videos |

## Integration Phase — Finalization

| Step | Skill | Input | Output |
|---|---|---|---|
| 13 | `/workflow-episode` | web.md + world entries (via generate_episode.py) | episode.json |
| 14 | `/workflow-complete` | draft.md vs arc.md beats | arc progress + next steps |

episode.json enables interactive mode for the chapter. Chapters without episode.json are text-only.

## Setup Skills

| Skill | Purpose | Output |
|---|---|---|
| `/workflow-new-series` | Create series foundation | series.md, style.md, writing-module.md, direction-module.md, sources/ |
| `/workflow-new-arc` | Create arc definition | arc.md, formula.md, sources/{N}/ |

## Utility Skills

| Skill | Purpose |
|---|---|
| `/workflow-status` | Show completed steps, recommend next action |
| `/workflow-reset` | Reset to a step, clearing it + subsequent files |

## Reset Reference

| Reset To | Files Cleared |
|---|---|
| `concept` | memory.md, route.md, draft.md, review.md |
| `memory` | memory.md, route.md, draft.md, review.md |
| `route` | route.md, draft.md, review.md |
| `compose` | draft.md, review.md |
| `review` | review.md |
| `web` | web.md |
| `model` | model.md, set.md, staging.md, pages/*/* |
| `set` | set.md, staging.md, pages/*/* |
| `world` | world/*/*.jpg (reference images only, keeps .md entries) |
| `staging` | staging.md, pages/*/* |
| `pages` | pages/*/* (panel images only) |
| `video` | media/* (BGM, TTS, videos) |
| `episode` | episode.json |

concept.md is never cleared — permanent audit trail.

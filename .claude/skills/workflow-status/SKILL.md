---
name: workflow-status
description: Check workflow state. Shows completed steps and recommends next action.
allowed-tools: Read, Glob
---

# Workflow Status

Display current workflow state.

## Process

1. **Find active chapter** — scan `chapters/*/meta.json` for incomplete workflows
2. **Read `meta.json`** — parse step completion
3. **Check arc progress** — compare chapter routes against `arcs/{arc}/arc.md` beats
## Output

```
STATUS: Chapter {N} (Arc {A})

Steps:
✓ objective
✓ memory
→ route
  compose
  review
  web
  complete

Arc: {X}/{Y} beats

Next: /workflow-route
```

**No active workflow:**
```
STATUS: No active workflow

Chapters: {N} complete
Arc: {X}/{Y} beats

Next:
• /workflow-update-world {N} — update world entries + reference images
• /workflow-video {N} — generate BGM, TTS, and video
• /workflow-new-chapter {N+1} — continue arc
```

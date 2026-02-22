---
name: workflow-reset
description: Reset workflow to a specific step, clearing it and all subsequent steps. Use to redo part of the workflow or manually set state.
allowed-tools: Read, Write, Glob
argument-hint: [step-name] or done [step-name]
---

# Reset Workflow Step

Reset to a specific step, or mark a step as done.

## Arguments

- `$ARGUMENTS` - Step name to reset to, or `done [step]` to mark complete
  - Text phase: `concept`, `memory`, `route`, `compose`, `review`, `web`
  - Visual phase: `model`, `set`, `world`, `staging`, `pages`, `video`
  - Integration: `episode`, `complete`
  - `done [step]` — mark step completed without running it

## Step Order

`concept → memory → route → compose → review → web → model → set → world → staging → pages → video → episode → complete`

## Reset Mode (default)

1. Find active chapter (highest `chapters/*/meta.json`)
2. Mark specified step + ALL subsequent steps as incomplete in meta.json
3. Clear wordCount if resetting before compose; clear review metrics if before review
4. **Clear affected .md files** (write empty content, preserve files):

| Reset To | Files to Clear |
|---|---|
| `concept` | memory.md, route.md, draft.md, review.md |
| `memory` | memory.md, route.md, draft.md, review.md |
| `route` | route.md, draft.md, review.md |
| `compose` | draft.md, review.md |
| `review` | review.md |
| `web` | web.md |
| `complete` | (none) |

**Never clear** meta.json or concept.md — concept.md is a permanent audit trail.

## Done Mode

Mark a step as completed with timestamp. Use when you manually wrote a file or want to skip a step.

## Output

```
RESET: Chapter {N} → {step}
Cleared: {steps} | Files: {files}
Next: /workflow-{step}
```

---
name: workflow-complete
description: Finalize chapter with executive summary. Checks arc progress by comparing draft against arc beats. Use after /workflow-web.
allowed-tools: Read, Write, AskUserQuestion
---

# Complete Chapter

Provide executive summary and check arc progress.

## Process

1. **Read files**:
   - `meta.json` — chapter number, arcId, word count
   - `draft.md` — chapter content
   - `arcs/{arc}/arc.md` — arc beats

2. **Check arc progress**:
   - Compare draft content against beats in arc.md
   - Report which beats this chapter covers

3. **Mark complete** — set `complete.completed = true`, `status: "complete"`

4. **Sync** — publish the completed chapter to the web reader:
   ```bash
   npm run sync
   ```

## Output

```
CHAPTER {N} COMPLETE: "{Title}"

Words: {wordCount}
Arc: {X}/{Y} beats covered

Next: /workflow-new-chapter {N+1}
```

If all arc beats covered, suggest `/workflow-new-arc` instead.

To start the Imagine phase for this chapter, suggest `/workflow-model {N}`.

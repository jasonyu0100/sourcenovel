---
name: workflow-review
description: Review draft for fidelity and engagement. Prompts rewrite if needed. Runs after /workflow-compose.
allowed-tools: Read, Write, AskUserQuestion
---

# Review Draft

Compare draft against route and memory. Assess engagement and word count.

## Process

1. **Load**: route.md, memory.md, draft.md, `modules/writing-module.md` (for target word count)

2. **Route coverage** — for each node: ✅ present | ⚠️ deviated | ❌ missing

3. **Memory coverage** — verify "Key Elements" from memory.md appear in draft

4. **Word count** — compare against writing module target (±10% = on target)

5. **Engagement** — does tension build? Is protagonist active? Does it pull forward? Verdict: `DELIVERS` | `NEEDS WORK` | `FALLS FLAT`

6. **Verdict**: **PASS** (100% coverage + DELIVERS + on target) or **REVISE** (any gaps/issues)

7. **Save** `chapters/{N}/review.md`:
   ```
   Route: X/Y (Z%) | Memory: X/Y (Z%) | Words: {actual}/{target} | Engagement: {verdict}
   Verdict: PASS | REVISE
   ## Gaps | ## Word Count Notes | ## Engagement Notes
   ```

8. **If REVISE** — ask user: Rewrite to fix gaps / Adjust word count / Skip
   - Trimming: cut redundancy, preserve emotional beats
   - Expanding: develop underdeveloped scenes, add sensory detail
   - After rewrite, re-verify word count

9. **Update** meta.json: `review.completed = true`, update `wordCount`

## Output

```
REVIEW {PASSED|NEEDS REVISION}: Chapter {N}
Route: {X}/{Y} | Words: {actual}/{target} | Engagement: {verdict}
Files: └── chapters/{N}/review.md
Next: /workflow-web
```

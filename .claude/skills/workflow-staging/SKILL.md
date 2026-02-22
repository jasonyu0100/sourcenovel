---
name: workflow-staging
description: Transform model beats into manga panel prompts with visual direction.
allowed-tools: Read, Write, Glob
argument-hint: <chapter-number>
---

# Workflow Staging

Transform spatial model into panel prompts. Third step of the **Imagine Phase**.

## Core Problem

**Each panel generates in complete isolation.** No memory between shots. Every panel must fully reconstruct the scene from scratch.

## Arguments

- `$ARGUMENTS` - Chapter number (e.g., `3`)

## Prerequisites

- `chapters/{N}/pages/model.md` — spatial model with positions
- `chapters/{N}/pages/set.md` — locations, costumes, props
- `/workflow-world` complete — reference images exist

## Process

### 1. Load Context

Read: `model.md`, `set.md`, `world/index.md`, glob `world/characters/*.jpg` and `world/locations/*.jpg`

### 2. Opening Hook

**Page 1 grabs the audience immediately.** Lead with emotion or tension, not cold establishing shots. Good openers: close-up on reaction, gesture mid-motion, charged proximity, object implying story.

### 3. Prompt Construction

Every prompt must answer:
1. **Where is the camera?** (distance, height, angle)
2. **Where is the subject?** (position in room)
3. **What's visible?** (behind/beside subject)
4. **Lighting direction?** (relative to camera)

**Structure:** `[SHOT + CAMERA]. [SUBJECT + POSITION + ACTION]. [WHAT'S VISIBLE]. [EXPRESSION]. [LIGHTING]. | [STYLE]`

### 4. Shot Types & Reference Strategy

| Shot | Frame | Location Ref | Background |
|------|-------|--------------|------------|
| Extreme wide | Tiny figures, full room | REQUIRED | Describe full room layout |
| Wide | Full bodies, furniture | REQUIRED | Describe room elements |
| Medium wide | Full body, surroundings | REQUIRED | Describe immediate area |
| Medium | Waist up | REQUIRED if room visible | Describe what's behind |
| Medium close-up | Chest up | Optional | Can abstract |
| Close-up | Face fills frame | OMIT | Emotional background |
| Extreme close-up | Detail only | OMIT | Abstract |

**Rule:** If prompt mentions room elements (walls, furniture, windows), include location ref.

#### Effect Panels (No Location Ref)

Stylized backgrounds for emotional/power moments:

| Type | Background Treatment |
|------|---------------------|
| Power effects | Stylized energy, color swirls |
| Memory/flash | Soft blur, dreamlike, sepia |
| Impact | Dark radiating lines, shattered |
| Shock | Stark contrast, world falling away |
| Tension | Heavy crosshatching, dark vignette |
| Intimacy | Soft bokeh, warm gradient |

### 5. Continuity

Maintain consistency through descriptions:

- **Positions:** Same until movement beat
- **Lighting:** Same direction throughout scene (describe relative to camera angle)
- **Movement:** When character moves, next panel shows NEW position

### 6. Multi-Character Scenes

**180° Rule:** Establish axis early (who is LEFT, who is RIGHT). Never flip without movement beat.

**In prompts:**
- Use distinguishing features ("dark-haired man", "brunette woman")
- Explicit positions ("LEFT of frame", "RIGHT of frame")
- State spatial relationship ("facing each other", "three meters apart")
- Either show both or explain why one isn't visible

**Refs:** Order left-to-right as they appear in frame.

### 7. Layouts

| Layout | Panels | Best For |
|--------|--------|----------|
| `splash` | 1 | Maximum impact: openers, reveals, climaxes |
| `impact2` | 2 | Before/after, cause/effect |
| `cinematic3` | 3 | Sequential flow, dialogue exchanges |
| `story4` | 4 | Standard narrative (default workhorse) |
| `focus4` | 4 | One key moment + context |
| `2x2` | 4 | Equal weight moments |
| `story5` | 5 | Dense storytelling, many beats |
| `2x3` | 6 | Many small beats, montage |
| `hero` | 3 | Character introduction/showcase |

**Guidelines:**
- Content first, variety second
- Avoid consecutive repeats (max 2)
- Aim for 6-8 different layouts per chapter
- `hero` for character introductions

**Constraints:**
- Tall slots (focus4): Avoid extreme close-ups — use full-body
- Wide slots (cinematic3): Great for environments, avoid tall subjects

### 8. Write staging.md

```markdown
# Chapter {N} Panels

## Page 1 — {description}
**Layout:** splash

### Panel 1: establishing
**Camera:** Wide shot from doorway, eye level
**Prompt:** Wide shot, camera at room entrance. Officers quarters interior. Dark-haired man seated on couch LEFT, brunette woman leaning against him RIGHT. Window back wall shows city lights. Warm amber lighting. | anime manga, cel shading, clean linework, dramatic lighting
**Ref:** world/characters/idris.jpg, world/characters/sera.jpg, world/locations/quarters-wide-couch.jpg
**Dialogue:** Sera: "Where is he?"
```

### 8.1 Dialogue Transfer (CRITICAL)

**Every dialogue line from model.md must appear in staging.md panels.**

**Format:**
```
**Dialogue:** Speaker: "Line"
**Bubble:** [descriptive placement guidance]
```

**Bubble guidance must describe:**
1. **Who is speaking** — character name
2. **Where they are in frame** — LEFT, RIGHT, CENTER, BACK, etc.
3. **Where bubble should go** — to avoid covering faces

**Examples:**

Close-up (single character):
```
**Dialogue:** Jace: "Stay away from Rei Ashford."
**Bubble:** Speech from Jace, face fills frame center-bottom, place bubble TOP avoiding face
```

Two-shot:
```
**Dialogue:** Nina: "Shift handoff. How's our S-Class patient?"
**Bubble:** Speech from Nina on RIGHT at doorway, place bubble TOP-RIGHT with tail pointing to her
```

Two-shot with speaker on left:
```
**Dialogue:** Kade: "She's not anyone's."
**Bubble:** Speech from Kade on LEFT facing Jace, place bubble TOP-LEFT with tail pointing left to speaker
```

Medium shot with character in doorway:
```
**Dialogue:** Nina: "Something interesting happening here."
**Bubble:** Speech from Nina in doorway BACK of frame, place bubble TOP-CENTER with tail pointing down toward her
```

**Placement rules:**
1. **Never cover faces** — bubble goes in empty space opposite the face
2. **Tail points to speaker** — indicates who is talking
3. **Use scene knowledge** — describe WHERE the character is, not just abstract positions

| Shot Type | Guidance Pattern |
|-----------|-----------------|
| Close-up | "Speech from [Name], face fills frame, place bubble TOP" |
| Two-shot, speaker LEFT | "Speech from [Name] on LEFT, place bubble TOP-LEFT tail-left" |
| Two-shot, speaker RIGHT | "Speech from [Name] on RIGHT, place bubble TOP-RIGHT tail-right" |
| Character in background | "Speech from [Name] in [location], place bubble with tail pointing toward them" |

**Verification:** After writing staging.md, count dialogue entries and compare to model.md. They must match.

### 8.2 Internal Thoughts (Solo Scenes)

**When a character is alone, use internal monologue instead of leaving pages silent.**

Solo scenes (one character, no one to talk to) benefit from thought bubbles that reveal inner state. This keeps the reader engaged and prevents long stretches of purely visual storytelling.

**When to use internal thoughts:**
- Character processing events alone
- Emotional reactions with no one present
- Decision-making moments
- Flashback/memory sequences from character's POV
- Observation scenes (watching others from distance)

**Format:**
```
**Dialogue:** Rei: "I shouldn't want this."
**Bubble:** Internal thought from Rei, close-up on face, place thought bubble TOP as internal monologue
```

**Thought bubble guidance:**
- Use "Internal thought from [Name]" to indicate it's not spoken aloud
- Place in same positions as speech bubbles (TOP avoiding face)
- Can use cloud-style bubble instead of pointed speech bubble

**Examples from draft to pull thoughts from:**
- Internal conflict: *"I shouldn't want this."* → `"I shouldn't want this."`
- Realization: *"She told herself never again."* → `"Never again."`
- Memory trigger: *"Fifteen years ago..."* → `"Just like before."`

**Solo scene types:**

| Scene Type | Thought Content |
|------------|-----------------|
| Processing aftermath | Emotional reaction, "What just happened" |
| Observation | Commentary on what they're seeing |
| Decision point | Internal debate, choice being made |
| Memory/flashback | Connection to past, "This reminds me of..." |
| Walking/traveling | Anticipation, planning, worry |

**Rule:** If a page has only one character and no dialogue, add at least one internal thought to maintain engagement.

### 8.3 Thought Density in Action Sequences (CRITICAL)

**Images alone cannot tell the story.** Visual storytelling is important, but readers need internal thoughts to understand *what's happening* and *why it matters*. Don't rely purely on the images.

**The Guidance Principle:** In action/emotional sequences, ensure every 2-3 pages has dialogue or internal thoughts. Pure visual sequences of 3+ pages lose the reader.

**Bad pattern (visual overload):**
```
Page 12: Hand grabs arm (no dialogue)
Page 13: Energy flows between them (no dialogue)
Page 14: Expression of overwhelm, release (no dialogue)
```
Reader sees action but doesn't understand significance.

**Good pattern (thought-guided):**
```
Page 12: Hand grabs arm → "What is this—"
Page 13: Energy flows → "This is what she feels for you?"
Page 14: Release → "They love her too. All of them."
```
Thoughts anchor the visual action in meaning.

**When staging action sequences:**
1. Check model.md for thoughts captured during action
2. If no thoughts exist, add them from draft or infer from context
3. Distribute thoughts across pages (not all on one page)
4. Key moments need thoughts: power activation, realization, aftermath

**Verification:** After staging action sequences, count consecutive pages without dialogue. If 3+, redistribute or add thoughts.

### 9. Verification Pass

After writing all pages, verify:

**Dialogue Transfer:**
- Count DIALOGUE entries in model.md: {X}
- Count **Dialogue:** lines in staging.md: {Y}
- **X must equal Y** — every spoken line needs a panel

**Dialogue Pacing:**
- Check pages for consecutive silent stretches
- **Max 2 silent pages in a row** (except intentional sequences like "watching" scenes)
- If 3+ silent pages: redistribute dialogue or add a line from draft
- Map dialogue by page: P1 ○, P2 ○, P3 ●, P4 ○... (● = has dialogue)

**Dialogue-Panel Alignment:**
- Speaker must be VISIBLE or just exited frame
- If two-shot: speaker should match character position (LEFT character speaks → bubble on LEFT)
- Check refs include the speaking character
- Order refs LEFT-to-RIGHT matching character positions

**Location Refs:**
- Wide/medium with environment → has ref ✅
- Effects/memory panels → NO ref ✅
- Close-ups → emotional background in prompt ✅

**Layouts:**
- 6+ types used
- No 3+ consecutive repeats
- `hero` for character introductions

**Spatial:**
- 180° axis maintained per scene
- LEFT/RIGHT explicit in two-shots

**Content Filtering:**
Scan all prompts for flaggable language:
- No suggestive terms: "sensual", "desire", "arousal", "provocative"
- No explicit violence: "dead", "kill", "blood"
- Replace with neutral equivalents (see Content Filtering Rules)

**Anti-Hallucination:**
Scan all prompts for violations:
- No dialogue in prompts (remove quoted speech)
- No narrative context ("The healer who absorbs...", "Two burnouts finding each other")
- No thoughts/feelings ("Something overwhelming hitting her", "Never met anyone like this")
- No poetic/metaphorical language ("Tension thick enough to cut", "threads connecting", "tangling")
- No abstract concepts that will render literally
- Only visible, photographable content

**Abstract Panels:**
- Every effects/power panel has "No figures visible" or "Abstract effects panel"
- No metaphorical descriptions that could render literally

**Symbol Density (CRITICAL):**
- **Max 1 symbolic panel per page** (memory, flash, abstract energy)
- **Never 2+ symbolic panels in a row** — loses meaning, becomes noise
- Symbolic panels must be surrounded by grounded panels (character faces visible)
- If page has 4 panels: 1 symbolic max. If 3 panels: 1 symbolic max. If 2 panels: 0-1 symbolic.
- If model.md has consecutive SYMBOLIC beats, **collapse them** into one panel or **insert grounded panel between**

| Page Layout | Max Symbolic | Grounding Required |
|-------------|--------------|-------------------|
| splash (1) | 0 (must be grounded) | N/A |
| impact2 (2) | 1 | Other panel grounded |
| cinematic3 (3) | 1 | 2 grounded panels |
| story4 (4) | 1 | Surrounded by grounded |
| story5 (5) | 1-2 | Never adjacent |

**Symbol overload example (BAD):**
```
Page 4:
- Panel 1: Close-up hands touching (partial)
- Panel 2: Mira's reaction (grounded) ✓
- Panel 3: Memory flash warmth (SYMBOLIC)
- Panel 4: Memory flash cracking (SYMBOLIC) ← PROBLEM
```

**Fixed version (GOOD):**
```
Page 4:
- Panel 1: Close-up hands touching
- Panel 2: Mira's reaction — eyes widening (grounded)
- Panel 3: Memory flash warmth + cracking COMBINED (SYMBOLIC)
- Panel 4: Rei watching Mira's response (grounded)
```

**Output:**
```
STAGING VERIFICATION: Chapter {N}
Dialogue: {X}/{Y} transferred from model
Dialogue pacing: ●○○●●○●●... (max 2 silent in a row)
Speaker alignment: {X}/{Y} verified
Location Refs: {X}/{Y} required present | {A} effects omitted
Layouts: {N}/11 types ({list})
Symbol density: {X} pages with 2+ symbolic panels (should be 0)
Content flags: {X} potential issues
Hallucination: {X} violations found
Verdict: PASS | REVISE
```

If REVISE, list issues and fix before proceeding.

### 10. Update meta.json

Set `steps.staging.completed = true`.

## Output

```
STAGING VERIFIED: Chapter {N}
Panels: {Y} | Pages: {Z}
Layouts: {N}/11 types
Verdict: PASS

Files: └── pages/staging.md
Next: /workflow-pages {N}
```

---

## Anti-Hallucination Rules

Models render literally. Follow these:

1. **Only visible things.** Translate thoughts to posture/expression.
2. **What IS there, not ISN'T.** "No insignia" → generates insignia. Say "bare collar".
3. **No readable text.** Describe objects, not content.
4. **No precise numbers.** "Standing far apart" not "three meters."
5. **Avoid reflections.** Use profile-against-glass.
6. **Simplify hands.** Single actions: "hand on glass."
7. **Max 3 characters per frame.**
8. **No poetic language.** Literal interpretation only.

| BAD | GOOD |
|-----|------|
| "Professional mask" | "Expression neutral, controlled" |
| "Walls up" | "Guarded posture, arms crossed" |
| "Stone-faced" | "Expression impassive" |
| "Tension thick enough to cut" | "Both figures rigid, shoulders tense" |

**Test:** "Can a camera photograph this?" If no, rewrite.

---

## Content Filtering Rules

Image APIs flag certain language. Avoid these triggers:

### Sexual/Suggestive (will be flagged)
| AVOID | USE INSTEAD |
|-------|-------------|
| "lounging sensually" | "relaxed posture" |
| "sheer sensuality" | "confident expression" |
| "absorbed desire/arousal" | "processing sensation" |
| "want floods through" | "warmth spreading" |
| "provocative pose" | "casual stance" |

### Violence (may be flagged)
| AVOID | USE INSTEAD |
|-------|-------------|
| "wants you dead" | "wants you destroyed" |
| "killing intent" | "hostile intent" |

**Rule:** Describe the visual, not the narrative implication.

---

## Abstract Effects Panels

For energy, power, or emotional effect panels:

**CRITICAL:** State "No figures visible" or "Abstract effects panel" explicitly.

| BAD | GOOD |
|-----|------|
| "Green mist reaching toward figure" | "Abstract effects panel. Green mist and energy tendrils. No figures visible." |
| "Power connecting them" | "Abstract energy collision. Amber meeting green. No figures visible." |
| "Sensations tangling between them" | "Two colored auras radiating toward center. Amber LEFT, cool blue RIGHT. No figures." |

**Why:** Without explicit "no figures", the model will hallucinate random characters into abstract scenes.

---

## Literal Interpretation Pitfalls

The model interprets EVERYTHING literally. Common failures:

| PROMPT SAYS | MODEL GENERATES |
|-------------|-----------------|
| "emotional threads connecting" | Literal threads/strings between figures |
| "tangling sensations" | Figures physically tangled |
| "watching everything" | Character merged into wall/environment |
| "tension visible" | Literal tension lines or stressed objects |
| "weight of the moment" | Heavy objects or weighted-down figures |
| "all the threads converging" | Thread/string imagery, spider web |

**Fix:** Replace metaphorical language with visual descriptions:
- "emotional threads" → "colored auras radiating toward center"
- "tangling sensations" → "overlapping energy glows"
- "watching everything" → "standing against wall, observing"
- "all threads converging" → "distant colored glows visible through window"

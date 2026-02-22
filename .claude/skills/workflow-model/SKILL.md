---
name: workflow-model
description: Create a spatial model from chapter prose. Extracts scenes, beats, positions, and dialogue.
allowed-tools: Read, Write, Glob
argument-hint: <chapter-number>
---

# Workflow Model

Create a spatial model from chapter prose. This is the first step of the **Imagine Phase** — defining positions and movement before staging panels.

**Important:** This script is the *basis* for manga, not the final panel count. The script captures dialogue, key actions, and emotional beats. The Plan phase will *expand* this into full manga storytelling — adding reaction shots, silent panels, atmosphere beats, and visual details that manga requires but a film script wouldn't specify.

## Arguments

- `$ARGUMENTS` - Chapter number (e.g., `3`)

## Prerequisites

- Chapter must be complete (draft.md exists)
- `modules/direction-module.md` should exist

## Process

### 1. Load Context

Read:
- `chapters/{N}/draft.md` — the full chapter prose
- `modules/direction-module.md` — visual storytelling principles
- `style.md` — visual style keywords

### 2. Extract Scenes and Beats

Read the draft and break it into **scenes** (location/time changes) and **beats** (moments within scenes).

**A beat is:**
- A change in emotional state
- Information revealed
- A decision made or avoided
- A physical action with meaning
- A line of dialogue
- A silence that speaks

**Extract MORE than you think you need.** Count beats against prose paragraphs — if you have fewer beats than paragraphs, you're missing information.

### 2.0 Opening Hook (CRITICAL)

**The first 3-5 beats must hook the audience immediately.** Readers decide in seconds whether to continue. The opening should:

- **Start with tension, mystery, or emotion** — not setup or context
- **Show, don't establish** — drop into action/feeling, orient later
- **Create a question** — something unresolved that pulls forward

| Weak Opening | Strong Opening |
|--------------|----------------|
| Wide shot of location, then characters enter | Close-up on character's reaction to something unseen |
| Dialogue explaining the situation | Charged silence before words are spoken |
| Establishing the time/place | A gesture, glance, or movement that carries weight |

The model should front-load the hook beats — whatever creates immediate engagement comes first, context follows.

### 2.1 Spatial Staging (CRITICAL)

**Every scene needs a spatial model.** Before writing beats, define:

1. **STAGING** — Fixed elements in the space (furniture, doors, windows, key objects)
2. **POSITIONS** — Where each character starts in the scene
3. **BLOCKING** — How characters move through the scene (like stage directions)

**Why this matters:** Without spatial staging, panels show characters teleporting — sitting one moment, standing the next, suddenly across the room. This breaks visual continuity.

**Spatial rules:**

| Rule | Why |
|------|-----|
| Characters don't teleport | If position changes, show the MOVEMENT beat |
| Establish before isolating | Wide shot shows positions before close-ups |
| Consistent eyelines | If A is left of B in wide shot, A stays left in two-shots |
| 180° rule | Don't flip which side characters are on mid-scene |
| Movement needs motivation | Characters move FOR a reason (to answer door, look out window) |

### The 180° Rule

When two characters interact, an invisible **axis** runs between them. The camera stays on one side of this axis — so if Idris is LEFT and Sera is RIGHT in the establishing shot, that relationship holds until one of them *moves*.

**Declare the axis in POSITIONS:**

```
POSITIONS (start):
- Idris: seated on couch LEFT
- Sera: leaning against Idris RIGHT
AXIS: Idris LEFT, Sera RIGHT
```

**The axis can flip — but only through movement:**

```
### Beat 27: new silence
POSITION: Idris at door (RIGHT), Sera beside couch (CENTER-LEFT)
AXIS FLIP: Idris now RIGHT, Sera now LEFT (Maren's departure reframes the scene)

### Beat 28: Sera walks to window
POSITION: Sera moves from beside couch → at window
AXIS: Idris LEFT (at table), Sera RIGHT (at window)
```

After significant movement, re-declare the axis so staging knows the new spatial relationship.

**MOVEMENT beats:** When a character changes position, add an explicit beat:

```
### Beat 10: Sera rises
VISUAL: Medium on Sera rising from couch
POSITION: Sera moves from seated (couch) → standing (beside couch)
ACTION: She stands, attention sharpening
```

The POSITION line tracks where characters are. The Plan phase uses this to maintain continuity.

### 2.2 Location Consistency (CRITICAL)

**Every beat must belong to a defined location.** Before staging, ensure:

1. **LOCATION TAG** — Each scene declares its location from `world/locations/`
2. **BEAT INHERITANCE** — Beats within a scene inherit the scene's location
3. **TRANSITION BEATS** — When location changes, explicit scene break with new LOCATION

**Why this matters:** Without location consistency, panels show mismatched backgrounds — a character in the infirmary one panel, greenhouse elements bleeding in the next. Reference images depend on location tags.

**Location rules:**

| Rule | Why |
|------|-----|
| One location per scene | Scene breaks mark location changes |
| Use world/ location names | Enables reference image lookup |
| Interior details match location | Staging elements must exist in that location |
| Transitions are explicit | "---" scene break + new LOCATION declaration |

**Location format in model:**

```
## Scene 1: Infirmary
LOCATION: infirmary — clinical white, antiseptic cold
LOCATION_REF: world/locations/infirmary.md
TIME: Late night

STAGING:
- Medical bed: center
- Door: left wall
- Supply cabinet: right wall
```

The `LOCATION_REF` links to the world file for visual reference consistency. All beats in Scene 1 use infirmary elements only.

### 2.3 Beat Types & Symbol Balance (CRITICAL)

**Not all beats are equal.** Categorize each beat as:

| Beat Type | Description | Example |
|-----------|-------------|---------|
| **Grounded** | Character face visible, real location | Close-up on Rei's reaction |
| **Action** | Physical movement, gesture | Hand grabbing arm |
| **Symbolic** | Abstract, memory, energy, effect | Flash memory panel, energy burst |

**The Symbol Rule:** Max 1 symbolic/abstract beat per 4 beats. Symbolic panels without character grounding lose impact fast.

**Bad pattern (overload):**
```
Beat 3: SYMBOLIC - memory flash of warmth
Beat 4: SYMBOLIC - memory flash of cracking ice
Beat 5: SYMBOLIC - energy swirl
```
This becomes visual noise — the reader stops processing symbolism.

**Good pattern (grounded):**
```
Beat 3: GROUNDED - Close-up Mira's reaction
Beat 4: SYMBOLIC - memory flash of warmth
Beat 5: GROUNDED - Close-up Rei's eyes
Beat 6: ACTION - hand pulling away
```
Symbolic moments land because they're surrounded by character grounding.

**Mark beats in model.md:**
```
### Beat 4: absorption flash
TYPE: SYMBOLIC
VISUAL: Memory flash — amber warmth, male hands
ACTION: Transferred sensation hitting Mira
```

**Verification:** Count SYMBOLIC beats. If more than 25% of total, condense or convert some to grounded reactions.

### 3. Write model.md

Create `chapters/{N}/pages/model.md` — spatial model with beats.

**Beat format — keep it minimal:**

Each beat has:
- **VISUAL** — shot type and subject
- **POSITION** — only on movement beats (tracks state change)
- **ACTION** — what happens physically
- **DIALOGUE** — speaker and line (CRITICAL: must be captured for panels)
- **TYPE** — only for SYMBOLIC beats (marks abstract/memory content)

No EXPRESSION or MOOD — the Plan phase handles those through prompts.

### 3.1 Dialogue & Thought Capture (CRITICAL)

**Every spoken line AND key internal thoughts must have a corresponding entry.** These drive manga panels — if not captured here, they won't appear in staging or final panels.

**Format:**
- Spoken: `SPEAKER: "Exact dialogue from draft"`
- Internal: `SPEAKER (thought): "Internal monologue"`

**Rules:**
- One dialogue/thought entry per beat (split long exchanges into multiple beats)
- Use character names, not pronouns
- Preserve exact wording from draft
- Include ALL dialogue — nothing is too minor
- **For solo scenes:** Capture internal thoughts to prevent silent pages

| Draft | Model Beat |
|-------|-----------|
| "Your control signature is destabilized," Mira said. | `MIRA: "Your control signature is destabilized."` |
| Kade shrugged. "Heat burns it off." | `KADE: "Heat burns it off."` |
| *I shouldn't want this.* | `REI (thought): "I shouldn't want this."` |
| She told herself *never again*. | `CROSS (thought): "Never again."` |

**When to capture internal thoughts:**
- Solo scenes (character alone, no one to talk to)
- Key emotional moments written in italics in draft
- Decision points or realizations
- Observation scenes where character is watching but not speaking
- **Action sequences** — intersperse thoughts to guide readers through what's happening

**Why this matters:** Dialogue/thoughts missed in model.md → missing in staging.md → missing in panels.json → no bubbles in final images. Solo scenes without internal monologue feel empty.

### 3.2 Thought Density in Action Sequences (CRITICAL)

**Images alone cannot tell the story.** During action/emotional sequences, readers need internal thoughts to understand what's happening. Don't rely purely on visual storytelling.

**The Guidance Principle:** Every 2-3 action beats should have at least one thought/dialogue beat that explains what the character is experiencing or realizing.

**Bad pattern (visual-only):**
```
Beat 5: ACTION - hands touch, energy flows
Beat 6: ACTION - energy swirls between them
Beat 7: ACTION - expression of overwhelm
Beat 8: ACTION - pulling away
```
Reader sees pretty images but doesn't understand the significance.

**Good pattern (guided):**
```
Beat 5: ACTION - hands touch, energy flows
Beat 6: JACE (thought): "This is what she feels for you?"
Beat 7: ACTION - expression of overwhelm
Beat 8: KADE (thought): "They love her too. All of them."
```
Thoughts anchor the visual action in meaning.

**When to add guiding thoughts:**
| Scene Type | Thought Frequency |
|------------|-------------------|
| Power exchange/transfer | Every 2 beats |
| Emotional realization | At climax + aftermath |
| Confrontation | Before/after key moments |
| Solo processing | Continuous internal monologue |
| Observation (watching) | Commentary on what they see |

**Rule:** If a sequence spans 3+ pages without dialogue/thoughts, it's too dense. Insert thoughts to break it up and guide the reader.

```markdown
# Chapter {N} Model

## Scene 1: {Location Name}
LOCATION: {Location} — {lighting/atmosphere}
LOCATION_REF: world/locations/{location-file}.md
TIME: {Time of day}

STAGING:
- Couch: center of room
- Door: right wall
- Window: back wall

POSITIONS (start):
- Idris: seated on couch LEFT
- Sera: leaning against Idris RIGHT
AXIS: Idris LEFT, Sera RIGHT

### Beat 1: {Beat title}
VISUAL: Medium on Idris seated on couch
ACTION: Goes still — sensing something before the knock

### Beat 5: Sera stirs
VISUAL: Medium on Sera
POSITION: Sera sits up on couch (no longer leaning)
ACTION: Sits up, attention sharpening

### Beat 10: Sera rises
VISUAL: Medium on Sera
POSITION: Sera moves from couch → standing beside couch
ACTION: Stands, shifting into strategic mode

### Beat 11: Dialogue beat
VISUAL: Two-shot across threshold
SERA: "Which units have moved?"

### Beat 27: the new silence
VISUAL: Wide shot, room after Maren leaves
POSITION: Idris at door (RIGHT), Sera beside couch (CENTER-LEFT)
AXIS FLIP: Idris RIGHT, Sera CENTER-LEFT

### Beat 28: Sera walks to window
VISUAL: Medium tracking Sera from behind
POSITION: Sera moves from beside couch → at window
AXIS: Idris LEFT (at table), Sera RIGHT (at window)
ACTION: Walks to window, back to Idris
```

**Key elements:**

- **STAGING** at scene start defines the space
- **POSITIONS (start)** shows where everyone begins
- **POSITION** in movement beats tracks changes
- Non-movement beats inherit previous position

### 4. Verify Coverage

**Script extraction checklist:**
- [ ] Every paragraph of prose has corresponding beats
- [ ] **Every dialogue line has a DIALOGUE entry with SPEAKER: "text" format**
- [ ] Every significant action has a beat
- [ ] Long dialogue broken into chunks (one line per beat)
- [ ] Dialogue count matches draft dialogue count

**Spatial continuity checklist:**
- [ ] Every scene has STAGING defined
- [ ] Every scene has POSITIONS (start) for all characters
- [ ] Every scene has AXIS declared (who is LEFT, who is RIGHT)
- [ ] Every character movement has a POSITION beat
- [ ] AXIS FLIP declared when significant movement changes the spatial relationship
- [ ] No character "teleports" without a movement beat

**Location consistency checklist:**
- [ ] Every scene has LOCATION declared
- [ ] Every scene has LOCATION_REF pointing to world/locations/ file (if exists)
- [ ] Scene breaks ("---") mark all location changes
- [ ] STAGING elements match the declared location
- [ ] No location bleed between scenes (infirmary elements don't appear in greenhouse)

### 5. Update meta.json

Set `steps.model.completed = true` and record beat count.

## Output

```
Model complete for Chapter {N}

Scenes: {X}
Beats: {Y}

Files:
  └── pages/model.md

Next: /workflow-set {N}
```

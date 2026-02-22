# Direction Module — The Ninth Terrace

## Philosophy

Manga is not illustrated prose — it is a distinct storytelling language where visuals carry narrative weight independently of text. Every panel is a camera angle, every page turn is pacing, every silent beat is dialogue. The goal is not to depict the draft, but to *retell* the story in visual language.

## The Three Phases

Visual adaptation follows a three-phase process:

### Phase 1: Script
Create a film-style script from prose. This phase captures *what* to show — scenes, beats, dialogue, and visual direction.

**Outputs:**
- `script.md` — Film-style script with scenes and dialogue

### Phase 2: Set
Design the production set. This phase defines visual elements for consistency — locations, costumes, props, and prompt guidance.

**Outputs:**
- `set.md` — Set design (locations, costumes, props, prompt guidance)

### Phase 3: Plan
Transform script into visual compositions. This phase is about *how* to show it — camera angles, shot types, layout, and panel prompts.

**Outputs:**
- `plan.md` — Full panel prompts with layout, refs, and dialogue

---

## Phase 1: Script

### 1.1 Scene and Beat Extraction

Read the draft and break it into **scenes** (location/time changes) and **beats** (moments within scenes). A beat is:
- A change in emotional state
- A piece of information revealed
- A decision made or avoided
- A physical action that carries meaning
- A line of dialogue
- A silence that speaks

**Extract more than you need.** It's easier to cut panels than to realize you skipped a crucial beat.

### 1.2 Adapting Prose to Script

Prose dialogue is written to be *read*. Script dialogue is written to be *shown*. Don't copy verbatim — preserve meaning while adapting for visual delivery:

- Prose attribution ("she said coldly") → EXPRESSION direction
- Narrative context around dialogue → VISUAL/ACTION direction
- Internal thought in prose → Expression, pause, or silent beat
- Long literary phrasing → Shorter, punchier delivery for speech bubbles

### 1.3 Script Format

Write a film-style script with full dialogue. Each scene contains beats with visual direction:

```markdown
## Scene 1: The Golden Avenue
LOCATION: Grand Promenade — cathedral arches, luminara trees
TIME: Evening amber glow, drifting light motes

### Beat 1: Scale and beauty
VISUAL: Extreme wide establishing
ACTION: The avenue stretches into golden distance, two silhouettes walking
MOOD: Peaceful surface, tension underneath

### Beat 2: The news drops
VISUAL: Medium on Sera, walking, not looking back
SERA: "The Senatorial Council voted. Formal dissolution — two Thrones by end of the standard week."
EXPRESSION: Grave, measured, controlled

### Beat 3: His non-reaction
VISUAL: Close-up on Idris
IDRIS: "I know."
EXPRESSION: Guarded, distant, already carrying the weight
PAUSE: Let the weight of his knowing land

### Beat 4: She sees through him
VISUAL: Two-shot, she glances back over shoulder
SERA: "You always know. You just never do anything about it."
EXPRESSION (Sera): Sharp knowing edge, frustration + affection
EXPRESSION (Idris): Closed off, avoidant
DYNAMIC: She pushes, he retreats
```

### 1.4 Information Audit

After extracting beats, audit for **missing information**:

| Question | Check |
|----------|-------|
| Would a reader understand what's happening? | Every essential plot point has a visual |
| Would they understand why it matters? | Emotional context is shown, not just told |
| Would they feel what the characters feel? | Expressions and body language are noted |
| Is any dialogue orphaned? | Every spoken line has visual context |
| Are any beats implied rather than shown? | Subtext must be visually readable |

**Common cuts to avoid:**
- Skipping setup beats (reader needs to see the "before" to feel the "after")
- Condensing dialogue exchanges (each speaker turn needs visual space)
- Assuming context (if it's not on the page, it doesn't exist)
- Dropping transitional moments (movement through space, passage of time)

---

## Phase 2: Set

Design the production set — everything that needs visual consistency across panels.

### 2.1 Locations

Plan angle variations for each location. Each variation can become a reference image:

```markdown
## Grand Promenade

### Establishing Variations
1. **promenade-wide-birdseye** — Full avenue length, cathedral arches, two small figures
2. **promenade-wide-eye** — Walking perspective, trees framing, architecture behind
3. **promenade-intimate-balustrade** — Close at balustrade, warm/cool light split

### Lighting Variations
4. **promenade-warm** — Warm amber dominant from luminara canopy
5. **promenade-cool** — Cool starlight dominant from void
6. **promenade-split** — Two kinds of light across the scene
```

### 2.2 Costumes

Note what characters wear, especially if it differs from their default:

```markdown
## Costumes

### Idris — Post-Mission
Outfit: Dark mandarin collar suit, clean lines, slightly creased from extraction
Prompt guidance: "dark mandarin collar suit with clean lines, slightly creased"

### Sera — Evening
Outfit: Fitted dark dress with tech-line accents at collar and cuffs
Prompt guidance: "elegant dark fitted dress with subtle tech-line accents"
```

### 2.3 Props & Objects

For objects without reference images, write exact prompt phrases:

```markdown
## Props

### Priority Dispatch Notification
Description: Holographic alert, distinctive double-pulse, military styling
Appears in: Scene 4 Beat 6
Prompt guidance: "faint blue holographic notification glowing from public broadcast column"

### Transport Vessel
Description: Small vessel with blinking running lights
Appears in: Scene 3 (silence beat)
Prompt guidance: "single small transport vessel with blinking running lights sliding through the dark"
```

### 2.4 Consistency Hierarchy

| Element | Reference Image? | Prompt Guidance? |
|---------|-----------------|------------------|
| Main characters | Yes (existing) | Yes (costume details) |
| Locations | Yes (angle variations) | Yes (atmosphere) |
| Key props | Maybe | Yes |
| Minor objects | No | Yes (exact phrases) |

**Refs are the first line of consistency** — visual anchors for things that repeat.
**Prompt guidance is the second line** — coherence for things without refs.

---

## Phase 3: Plan

**The script is a basis, not a 1:1 mapping.** Plan phase *expands* the script into full manga storytelling.

### 3.0 Expansion Principle

Manga requires more panels than a film script would indicate:

| Script beat | Plan expands to |
|-------------|-----------------|
| Dialogue line | Speaker panel + reaction panel |
| Significant action | Setup + action + aftermath |
| Emotional moment | Build-up + moment + silent beat |
| Scene transition | Establishing shot + transition |

**Expect 1.5-2x more panels than script beats.** The additions are:
- **Reaction panels** — Show how dialogue lands on the listener
- **Silent panels** — Let tension or emotion breathe
- **Detail shots** — Hands, eyes, objects carrying subtext
- **Atmosphere panels** — Environment reflecting mood
- **Establishing shots** — Ground the reader in space

### 3.1 Shot Selection

For each beat, choose the shot type that best serves the story:

| Shot Type | Best For | Emotional Register |
|-----------|----------|-------------------|
| Extreme wide | Scale, isolation, establishing | Awe, loneliness, context |
| Wide | Movement, relationship to space | Journey, searching, freedom |
| Medium wide | Full body + environment | Action, presence, entering |
| Medium | Waist-up, gesture visible | Conversation, normal focus |
| Medium close-up | Chest-up, expression clear | Dialogue, reaction, attention |
| Close-up | Face fills frame | Emotion, intimacy, impact |
| Extreme close-up | Detail (eyes, hands, object) | Tension, revelation, subtext |

**Shot rhythm rules:**
- Wide → Medium → Close (classic approach sequence)
- Close → Wide (reveal or aftermath)
- Never two of the same shot type consecutively
- Action panels need wider shots; emotion needs tighter

### 3.2 Camera Angle Psychology

| Angle | Effect | Use For |
|-------|--------|---------|
| Eye level | Neutral, equal | Normal conversation, baseline |
| Low angle | Power, dominance, threat | Authority, intimidation, awe |
| High angle | Vulnerability, smallness | Defeat, overwhelm, supervision |
| Dutch angle | Unease, instability | Tension, wrongness, crisis |
| Bird's eye | Omniscient, pattern | Scale, layout, distance |
| Worm's eye | Extreme power, dramatic | Reveals, confrontation |

### 3.3 Composition Elements

Every panel prompt must specify:

**1. Frame placement**
- Where in the frame each element sits (left third, center, right edge)
- What's in foreground/midground/background
- Negative space and where it falls

**2. Focus and depth**
- What's sharp vs. bokeh
- Depth of field (shallow for intimacy, deep for scale)

**3. Lighting direction**
- Light source position (side, back, overhead, below)
- Color temperature (warm/cool split for "two kinds of light")
- Rim lighting, silhouette, shadow placement

**4. Leading lines**
- Architecture, paths, gestures that guide the eye
- Diagonal vs. horizontal vs. vertical energy

### 3.4 Expression Bible

Faces are the primary storytelling element. Never use generic descriptors.

**Build expressions from components:**
- **Eyes:** narrowed, soft, searching, distant, glistening, sharp, half-lidded
- **Brows:** raised, furrowed, one higher than other, relaxed
- **Mouth:** slight smirk, lips parted, jaw set, corner turned, pressed thin
- **Overall:** guarded, open, performing composure, cracking, raw

**Character-specific defaults:**

| Character | Composure State | Cracking State |
|-----------|----------------|----------------|
| Idris | Watchful, composed, still, dark eyes cataloguing | Softening around eyes, jaw relaxing, glimpse of tenderness |
| Sera | Sharp, evaluating, controlled precision | Eyes glistening, sharp edges dissolving, vulnerability showing |

### 3.5 Page Flow Planning

Each page is a unit of pacing. Plan the visual rhythm:

**Opening panel (hook):**
- Widest/most striking image
- Sets location, mood, or intrigue
- Draws the eye first

**Development panels:**
- Carry the conversation or action
- Vary shot distance and angle
- Balance action panels (left) with reaction panels (right)

**Closing panel (turn):**
- What the reader takes to the next page
- Reveals, cliffhangers, emotional beats
- Lingers in memory during page turn

### 3.6 Silent Panel Power

Not every panel needs dialogue. Silent panels:
- Let visuals carry emotional weight
- Create breathing room in dense exchanges
- Amplify tension through absence
- Work best for: reactions, transitions, reveals, intimacy

**When to use silence:**
- After a heavy line (let it land)
- During physical action
- For pure emotional beats
- Environmental establishing shots
- Intimate moments where words would intrude

---

## Visual Storytelling Principles

### Show the Invisible

Prose can tell us what characters think. Manga must *show* it:
- Thought through expression and body language
- Emotion through lighting and composition
- Tension through framing and negative space
- Time through panel rhythm and layout

### The 3-Second Rule

A reader spends ~3 seconds on each panel. In that time:
- Is the emotion readable?
- Is the action clear?
- Is the dialogue positioned naturally?
- Does the eye know where to go next?

### Subtext Through Composition

What's NOT said is shown through:
- Distance between characters (emotional gap)
- Eye contact vs. avoidance
- Hand position (reaching, withdrawing, anchoring)
- Light/shadow division (internal conflict)
- Frame edges (isolation, exclusion)

### The Page Turn as Punctuation

- End pages on incomplete beats for tension
- Use full-page reveals after page turns for impact
- Never split a single moment across a page turn
- Page turn = narrative breath

---

## Common Failures to Avoid

| Failure | Problem | Fix |
|---------|---------|-----|
| Talking heads | Same angle, same distance, boring | Vary shots, add environment, show body language |
| Missing setups | Reader confused by payoffs | Include the "before" for every "after" |
| Generic backgrounds | Flat, repetitive spaces | Use background variations, add depth layers |
| Orphaned dialogue | Lines without visual context | Show speaker, show reaction, show environment |
| Expression shortcuts | "Smiling" / "serious" | Describe specific facial components |
| Over-dialogue | Text overwhelms visuals | Trust the art, cut redundant words |
| Same-angle repetition | Visual monotony | Rotate through perspective variations |
| Skipped transitions | Jarring location jumps | Add establishing shots when entering spaces |

---

## Integration with Writing Module

The manga module extends the writing module's principles:

| Writing Module | Manga Module |
|----------------|--------------|
| Subtext carries weight | Expression and composition carry subtext |
| Say less than they mean | Show more than they say |
| Interior woven into observation | Interior shown through visual attention |
| Rhythm shifts with emotion | Panel rhythm shifts with pacing |
| Cool observation as default | Wide shots and controlled compositions |
| Quiet devastation | Single detail panel that lands like a punch |

---

## Checklist Before Generating

- [ ] Every draft beat has a corresponding visual beat
- [ ] No information is implied rather than shown
- [ ] Backgrounds have perspective variations planned
- [ ] No consecutive panels use the same angle
- [ ] Every expression is specifically described
- [ ] Silent panels are intentional, not lazy
- [ ] Page endings create forward momentum
- [ ] Visual rhythm matches emotional pacing

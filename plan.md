# World Simulation: Turn-Based AI Storytelling

## Concept

A turn-based simulation where characters occupy locations on the world map. Each turn, every character (NPC) gets an AI call to decide their action — move, interact, speak, etc. A world log captures emergent narrative. The user can roleplay as one character while NPCs act autonomously. The map is fractal — locations can contain sub-locations for zoom-in detail.

## Architecture

### 1. Fractal Map Data (`world-map.json` extension)

Extend `WorldMapLocation` with optional `children` — sub-locations within a location. This makes the map recursive: clicking a station zooms into its own sub-map.

```typescript
// lib/world-types.ts additions
interface WorldMapLocation {
  slug: string;
  name: string;
  description: string;
  image: string;
  connections: WorldConnection[];
  children?: WorldMapLocation[];  // fractal sub-locations
}
```

Example: "Grand Promenade" might contain `luminara-grove`, `viewing-plaza`, `stone-benches`. When you zoom in, those render as their own mini-map. Characters can be "at Grand Promenade" (coarse) or "at the Viewing Plaza within Grand Promenade" (fine).

### 2. Simulation Data Model (new JSON files)

**`world-simulation.json`** — scenario definition (static, authored):
```json
{
  "id": "tensions-rising",
  "name": "Tensions Rising",
  "description": "Both Thrones recall their Adepts. The Council convenes.",
  "characters": [
    {
      "slug": "sera",
      "name": "Sera Kaine",
      "profile": "characters/sera.md",
      "startLocation": "vantage-concourse",
      "faction": "sovereignty",
      "goals": ["Return to the Ninth Terrace", "Confront Idris"],
      "personality": "Strategic, furious beneath composure, conflicted loyalty"
    },
    {
      "slug": "idris",
      "name": "Idris Vael",
      "profile": "characters/idris.md",
      "startLocation": "prism-appraisal-shop",
      "faction": null,
      "goals": ["Protect the Terrace's neutrality", "Avoid being dragged back in"],
      "personality": "Quiet, watchful, dangerous when pushed"
    }
  ],
  "worldState": "The Senatorial Council has voted. Both Thrones recall Adepts. Tension is rising.",
  "maxTurns": 50
}
```

### 3. Convex Schema Extensions

New tables for simulation state:

```typescript
// Simulation session — one per playthrough
simulations: defineTable({
  seriesId: v.string(),
  scenarioId: v.string(),
  userId: v.string(),
  playerCharacter: v.optional(v.string()),  // slug of character user controls, null = spectator
  turn: v.number(),
  status: v.string(),  // "active" | "paused" | "complete"
  worldState: v.string(),  // current narrative world state summary
  createdAt: v.number(),
  updatedAt: v.number(),
})

// Character state per simulation — position + status
simulationCharacters: defineTable({
  simulationId: v.id("simulations"),
  characterSlug: v.string(),
  locationSlug: v.string(),       // current location on map
  subLocationSlug: v.optional(v.string()),  // fractal sub-location
  status: v.string(),             // "idle" | "traveling" | "interacting"
  mood: v.string(),               // emotional state for AI context
  inventory: v.optional(v.string()),  // narrative items
  lastAction: v.optional(v.string()),
})

// Turn log — the world story log
simulationTurns: defineTable({
  simulationId: v.id("simulations"),
  turn: v.number(),
  worldNarration: v.string(),     // synthesized turn summary
  events: v.string(),             // JSON array of what happened
  createdAt: v.number(),
})

// Individual character actions per turn
simulationActions: defineTable({
  simulationId: v.id("simulations"),
  turn: v.number(),
  characterSlug: v.string(),
  actionType: v.string(),         // "move" | "interact" | "speak" | "wait" | "use"
  actionDetail: v.string(),       // what they did
  targetLocation: v.optional(v.string()),  // if moving
  targetCharacter: v.optional(v.string()), // if interacting
  narration: v.string(),          // AI-generated prose for this action
  createdAt: v.number(),
})
```

### 4. API: Turn Resolution (`/api/simulation/turn`)

Each turn:
1. Gather current world state, character positions, recent history
2. For each NPC (non-player characters), make an AI call:
   - System prompt: character profile + personality + goals + current location + nearby characters + world log (last 5 turns) + available connections
   - Response: `{ action, target, narration, dialogue, mood }`
3. Wait for player action (if user is controlling a character)
4. Resolve all actions simultaneously
5. Synthesize a world narration for the turn
6. Update all character positions and states
7. Append to world log

**AI prompt per character:**
```
You are {character.name}. {character profile}

Current state:
- Location: {location.name} — {location.description}
- Nearby characters: {list with their current mood/status}
- Your goals: {character.goals}
- Your mood: {character.mood}

World log (recent):
{last 3-5 turn summaries}

Available actions:
- MOVE to: {connected location names}
- INTERACT with: {nearby character names}
- SPEAK: say something to nearby characters
- WAIT: stay and observe

Respond with JSON:
{
  "action": "move|interact|speak|wait",
  "target": "location-slug or character-slug or null",
  "dialogue": "What you say, if anything",
  "innerThought": "What you're thinking (not visible to others)",
  "narration": "Third-person prose of what you do",
  "mood": "Your emotional state after this action"
}
```

### 5. UI: Simulation Mode on World Map

Extend the world page with a simulation mode toggle:

- **Map overlay**: Character avatars drawn on station nodes (small circular portraits at their current location)
- **Turn counter**: Shows current turn number
- **Turn log panel**: Scrollable sidebar showing world narration per turn, filterable by character
- **Action panel**: When it's the player's turn, show available actions (move to connected locations, interact with nearby characters, speak, wait)
- **Play/pause**: Auto-advance turns or step through manually
- **Character list**: Shows all characters, their location, mood, and faction

The world-map.tsx canvas will draw character avatars on top of station thumbnails. Multiple characters at one location stack as overlapping circles.

### 6. File Structure

```
series/the-ninth-terrace/world/
  world-map.json              (existing — add children for fractal)
  scenarios/
    tensions-rising.json      (scenario definition)
  characters/
    sera.md                   (existing)
    idris.md                  (existing)
    ...

app/[series]/world/
  page.tsx                    (extend with simulation mode)

app/api/simulation/
  turn/route.ts               (resolve a turn — AI calls for NPCs)

components/
  world-map.tsx               (extend: draw character avatars)
  simulation-panel.tsx         (turn log + action UI)
  simulation-controls.tsx      (play/pause/step + turn counter)

convex/
  schema.ts                   (add simulation tables)
  simulations.ts              (CRUD + turn resolution mutations)

lib/
  world-types.ts              (extend with simulation types)
  simulation-types.ts          (new: simulation-specific types)
```

### 7. Implementation Order

**Phase 1 — Data model & scenario setup**
1. Extend `world-types.ts` with fractal `children` and simulation types
2. Create `simulation-types.ts`
3. Add Convex schema tables
4. Create `convex/simulations.ts` with mutations
5. Author first scenario: `tensions-rising.json`

**Phase 2 — Turn resolution API**
6. Build `/api/simulation/turn` route
7. AI prompt construction per character
8. Action resolution logic (movement, interaction, collision)
9. World narration synthesis (summarize all actions into prose)

**Phase 3 — UI**
10. Add simulation state to world page
11. Draw character avatars on world-map canvas
12. Build `simulation-panel.tsx` (turn log + actions)
13. Build `simulation-controls.tsx` (play/pause/step)
14. Player action input (move/interact/speak/wait)

**Phase 4 — Fractal map**
15. Add `children` to select locations in `world-map.json`
16. Implement zoom-into-sublocation on the map canvas
17. Character position tracking at sub-location level

# Chapter 4 Set Design

## Locations

### Shared Quarters
Base: Officers' quarters — dark furniture, warm amber lighting, window overlooking city. Two lives layered into one space.
Existing ref: `world/locations/shared-quarters.md`

#### Required Variations

1. **quarters-cool**
   Same room but lighting shifted — amber warmth bled out, cool blue-white from screens dominant. The room feels colder, emptier. Used for Beats 24, 41, 50-58 as the argument strips the warmth away.
   ```
   manga anime style, interior officers quarters, cool blue-white lighting from screens, dark modern furniture, lived-in military apartment, window overlooking futuristic city at night, cold atmosphere, emotional distance, cel shading, detailed background art, no characters
   ```

2. **quarters-window-view**
   View through the window — futuristic city below at night, military convoys visible on streets, broadcast towers with cycling frequencies. The fracture happening outside. Used for Beats 14, 57.
   ```
   manga anime style, futuristic city at night through window, military convoys on streets below, broadcast towers with glowing frequencies, urban lights, sense of crisis and movement, sci-fi cityscape, cel shading, detailed background art, no characters
   ```

---

## Costumes

### Idris — Post-Maren
Same as existing ref. Dark mandarin collar suit, slightly creased from the evening.
Prompt guidance: "dark mandarin collar suit, clean lines, slightly creased"

### Sera — Evening
Same as existing ref. Elegant dark fitted attire with tech-line accents.
Prompt guidance: "elegant dark fitted attire with subtle tech-line accents"

No costume changes this chapter — both remain in what they wore during Chapter 3.

---

## Props & Objects

### Datapad (Recall Orders)
Description: Standard military datapad, dark casing, face-down on table. Represents the choice Idris won't make.
Appears in: Beats 2, 54
Prompt guidance: "military datapad face-down on dark table, untouched"

### Books on Desk
Description: Stack of his books on her desk — a detail of their layered life.
Appears in: Beat 52
Prompt guidance: "stack of leather-bound books on dark desk"

### Jacket on Chair
Description: Sera's jacket draped over Idris's chair — her presence even when absent.
Appears in: Beat 53
Prompt guidance: "elegant dark jacket draped over chair back"

### Door
Description: Standard officers' quarters door. Becomes the most important object in the room.
Appears in: Beats 42, 49
Prompt guidance: "dark metal door, officers quarters style, closed"

---

## Persistent Elements

### Lighting Signature
- **Warm (early)**: Amber glow from interior lighting — safety, intimacy, the life they built
- **Cool (late)**: Blue-white from screens — distance, the outside world intruding, warmth gone
- **Transition**: The shift happens gradually through the argument (Beat 24 marks the visible change)

### Atmosphere
- Room should feel smaller as the chapter progresses
- Door should feel larger as the chapter progresses
- Distance between characters is the visual story

---

## Generation Priority

**Must generate:**
1. `quarters-cool` — essential for second half of chapter
2. `quarters-window-view` — needed for city/convoy shots

**Already exists (no generation needed):**
- Shared quarters (warm) — `world/locations/shared-quarters.md`
- Idris character ref — `world/characters/idris.md`
- Sera character ref — `world/characters/sera.md`

**Props (prompt guidance only, no refs needed):**
- Datapad, books, jacket, door — described in prompts, not recurring enough to need dedicated refs

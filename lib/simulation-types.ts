// --- Scenario definition (static JSON, authored per series) ---

export interface ScenarioCharacter {
  slug: string;
  name: string;
  profile: string; // path to character .md file
  startLocation: string; // location slug
  faction: string | null;
  goals: string[];
  personality: string;
}

export interface ScenarioData {
  id: string;
  name: string;
  description: string;
  characters: ScenarioCharacter[];
}

// --- Relationship tracking ---

export interface RelationshipMap {
  // key: "charA:charB" (sorted alphabetically), value: -100 to 100
  [pairKey: string]: number;
}

export interface RelationshipDelta {
  characterA: string;
  characterB: string;
  delta: number;
  reason: string;
}

// --- Runtime simulation state ---

export interface SimCharacterState {
  characterSlug: string;
  locationSlug: string;
  subLocationSlug?: string;
  status: "idle" | "traveling" | "interacting";
  mood: string;
  lastAction?: string;
}

export interface SimAction {
  characterSlug: string;
  actionType: "move" | "interact" | "speak" | "wait";
  actionDetail: string;
  targetLocation?: string;
  targetCharacter?: string;
  dialogue?: string;
  innerThought?: string;
  narration: string;
  mood: string;
}

export interface SimTurnResult {
  turn: number;
  actions: SimAction[];
  worldNarration: string; // synthesized prose summary of the turn
}

// --- AI response shape ---

export interface CharacterAIResponse {
  action: "move" | "interact" | "speak" | "wait";
  target: string | null;
  dialogue: string | null;
  innerThought: string | null;
  narration: string;
  mood: string;
}

// --- Encounter pre-generation ---

export interface ConversationLine {
  speaker: string;
  speakerSlug: string;
  line: string;
  type: "dialogue" | "action" | "thought";
}

export interface EncounterDescriptor {
  locationSlug: string;
  characterSlugs: string[];
  encounterType: EncounterType;
  secondLocationSlug?: string;
}

export interface PreGeneratedEncounter extends EncounterDescriptor {
  conversation: ConversationLine[] | null;
  loading: boolean;
}

// --- Turn playback state machine ---

export type EncounterType = "convergence" | "crossover" | "near-miss";

export type PlaybackPhase =
  | { phase: "idle" }
  | { phase: "playing"; actionIndex: number }
  | { phase: "encounter"; encounterIndex: number }
  | { phase: "after-effects" }
  | { phase: "done" };

export interface PlaybackState {
  current: PlaybackPhase;
  turnResult: SimTurnResult | null;
  characterUpdates: SimCharacterState[];
  encounters: PreGeneratedEncounter[];
  relationshipDeltas: RelationshipDelta[];
  pendingResult: {
    turn: number;
    characterUpdates: { characterSlug: string; locationSlug: string; status: string; mood: string; lastAction?: string }[];
    actions: SimAction[];
    worldNarration: string;
  } | null;
}

// --- Client-side simulation view state ---

export type SimulationStatus = "idle" | "active" | "paused" | "complete";

export interface SimulationState {
  scenarioId: string;
  turn: number;
  status: SimulationStatus;
  playerCharacter: string | null; // slug or null for spectator
  characters: SimCharacterState[];
  turnLog: SimTurnResult[];
}

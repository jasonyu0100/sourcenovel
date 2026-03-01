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
  arcNum: number;
  name: string;
  description: string;
  characters: ScenarioCharacter[];
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
  actionType: "move" | "interact";
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

// --- Movement phase (phase 1) ---

export interface MovementDecision {
  characterSlug: string;
  decision: "move" | "stay";
  targetLocation?: string;
  reasoning: string;
}

// --- Turn playback state machine ---

export type PlaybackPhase =
  | { phase: "idle" }
  | { phase: "playing"; actionIndex: number }
  | { phase: "done" };

export interface PlaybackState {
  current: PlaybackPhase;
  turnResult: SimTurnResult | null;
  characterUpdates: SimCharacterState[];
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

import type { WorldMapData } from "./world-types";
import type { ScenarioData } from "./simulation-types";
import { API_BASE } from "./constants";

export async function loadWorldMap(seriesId: string): Promise<WorldMapData | null> {
  try {
    const res = await fetch(`${API_BASE}/${seriesId}/world/world-map.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadScenario(
  seriesId: string,
  scenarioId: string,
): Promise<ScenarioData | null> {
  try {
    const res = await fetch(
      `${API_BASE}/${seriesId}/world/scenarios/${scenarioId}.json`,
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadCharacterProfile(
  seriesId: string,
  profilePath: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/${seriesId}/world/${profilePath}`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

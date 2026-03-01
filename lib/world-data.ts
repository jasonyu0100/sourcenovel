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

export interface ArcInfo {
  arcNum: number;
  name: string;
  description: string;
}

export async function loadAvailableArcs(seriesId: string): Promise<ArcInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/${seriesId}/manifest.json`);
    if (!res.ok) return [];
    const manifest = await res.json();
    const arcs: { number: number; files: string[] }[] = manifest.arcs ?? [];

    // Only include arcs that have a scenario.json
    const arcsWithScenarios = arcs.filter((a) => a.files.includes("scenario.json"));

    // Load each scenario.json to get name/description
    const results = await Promise.all(
      arcsWithScenarios.map(async (arc) => {
        try {
          const scenarioRes = await fetch(`${API_BASE}/${seriesId}/arcs/${arc.number}/scenario.json`);
          if (!scenarioRes.ok) return null;
          const scenario = await scenarioRes.json();
          return {
            arcNum: arc.number,
            name: scenario.name as string,
            description: scenario.description as string,
          };
        } catch {
          return null;
        }
      }),
    );

    return results.filter((r): r is ArcInfo => r !== null);
  } catch {
    return [];
  }
}

export async function loadArcScenario(
  seriesId: string,
  arcNum: number,
): Promise<ScenarioData | null> {
  try {
    const res = await fetch(`${API_BASE}/${seriesId}/arcs/${arcNum}/scenario.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadScenarioContext(
  seriesId: string,
  arcNum: number,
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/${seriesId}/arcs/${arcNum}/scenario.md`);
    if (!res.ok) return null;
    return await res.text();
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

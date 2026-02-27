import type { WorldMapData } from "./world-types";
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

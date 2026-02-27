import type { WorldMapLocation } from "./world-types";

export function buildGraph(locations: WorldMapLocation[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const loc of locations) {
    graph.set(loc.slug, loc.connections.map((c) => c.target));
  }
  return graph;
}

export function findShortestPath(
  graph: Map<string, string[]>,
  start: string,
  goal: string,
): string[] | null {
  if (start === goal) return [start];
  const visited = new Set<string>([start]);
  const parent = new Map<string, string>();
  const queue: string[] = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of graph.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);
      if (neighbor === goal) {
        const path: string[] = [goal];
        let node = goal;
        while (parent.has(node)) {
          node = parent.get(node)!;
          path.unshift(node);
        }
        return path;
      }
      queue.push(neighbor);
    }
  }
  return null;
}

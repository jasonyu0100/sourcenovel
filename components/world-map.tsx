"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { WorldMapLocation, WorldMapCluster } from "@/lib/world-types";

interface WorldMapProps {
  seriesId: string;
  clusters: WorldMapCluster[];
  locations: WorldMapLocation[];
  defaultLocation: string;
  onSelectLocation: (slug: string) => void;
}

// Metro map constants
const STATION_RADIUS = 22;
const INTERCHANGE_RADIUS = 26;
const HIT_RADIUS = 30;
const GRID_X = 140;
const GRID_Y = 140;
const LINE_WIDTH = 4;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const NEUTRAL_COLOR = "#94a3b8";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * BFS layout with organic directional spread.
 * Each child picks a grid direction away from its parent,
 * spreading outward in 8 metro-legal directions.
 * Deterministic via slug-seeded rotation.
 */

const DIRECTIONS: [number, number][] = [
  [1, 0],   // E
  [1, -1],  // NE
  [0, -1],  // N
  [-1, -1], // NW
  [-1, 0],  // W
  [-1, 1],  // SW
  [0, 1],   // S
  [1, 1],   // SE
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function computeMetroLayout(
  locations: WorldMapLocation[],
  rootSlug: string,
  cx: number,
  cy: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const occupied = new Set<string>();
  const adjacency = new Map<string, Set<string>>();

  for (const loc of locations) {
    if (!adjacency.has(loc.slug)) adjacency.set(loc.slug, new Set());
    for (const conn of loc.connections) {
      adjacency.get(loc.slug)!.add(conn.target);
      if (!adjacency.has(conn.target)) adjacency.set(conn.target, new Set());
      adjacency.get(conn.target)!.add(loc.slug);
    }
  }

  const gridKey = (gx: number, gy: number) => `${gx},${gy}`;

  positions.set(rootSlug, { x: cx, y: cy });
  occupied.add(gridKey(0, 0));
  const gridPos = new Map<string, { gx: number; gy: number }>();
  gridPos.set(rootSlug, { gx: 0, gy: 0 });

  const queue: string[] = [rootSlug];
  const visited = new Set<string>([rootSlug]);

  while (queue.length > 0) {
    const parentSlug = queue.shift()!;
    const parentGrid = gridPos.get(parentSlug)!;
    const neighbors = adjacency.get(parentSlug);
    if (!neighbors) continue;

    const unplaced = Array.from(neighbors).filter((n) => !visited.has(n));
    if (unplaced.length === 0) continue;

    // Find directions already used by placed neighbors
    const usedDirs = new Set<number>();
    Array.from(neighbors).forEach((n) => {
      const ng = gridPos.get(n);
      if (!ng) return;
      const dx = Math.sign(ng.gx - parentGrid.gx);
      const dy = Math.sign(ng.gy - parentGrid.gy);
      const dirIdx = DIRECTIONS.findIndex(([a, b]) => a === dx && b === dy);
      if (dirIdx >= 0) usedDirs.add(dirIdx);
    });

    const availableDirs: number[] = [];
    for (let i = 0; i < 8; i++) {
      if (!usedDirs.has(i)) availableDirs.push(i);
    }
    for (let i = 0; i < 8; i++) {
      if (usedDirs.has(i)) availableDirs.push(i);
    }

    const parentSeed = hashSlug(parentSlug);
    const startOffset = parentSeed % 8;

    for (let ci = 0; ci < unplaced.length; ci++) {
      const childSlug = unplaced[ci];
      const sectorSize = Math.max(1, Math.floor(availableDirs.length / unplaced.length));
      const primaryIdx = (ci * sectorSize + startOffset) % availableDirs.length;

      const orderedDirs: number[] = [];
      for (let offset = 0; offset < 8; offset++) {
        const left = (primaryIdx + offset) % 8;
        const right = (primaryIdx - offset + 8) % 8;
        if (!orderedDirs.includes(availableDirs[left % availableDirs.length])) {
          orderedDirs.push(availableDirs[left % availableDirs.length]);
        }
        if (!orderedDirs.includes(availableDirs[right % availableDirs.length])) {
          orderedDirs.push(availableDirs[right % availableDirs.length]);
        }
      }

      let placed = false;
      for (const dirIdx of orderedDirs) {
        const [dx, dy] = DIRECTIONS[dirIdx];
        for (let dist = 1; dist <= 4; dist++) {
          const gx = parentGrid.gx + dx * dist;
          const gy = parentGrid.gy + dy * dist;
          const key = gridKey(gx, gy);
          if (!occupied.has(key)) {
            occupied.add(key);
            gridPos.set(childSlug, { gx, gy });
            positions.set(childSlug, {
              x: cx + gx * GRID_X,
              y: cy + gy * GRID_Y,
            });
            visited.add(childSlug);
            queue.push(childSlug);
            placed = true;
            break;
          }
        }
        if (placed) break;
      }

      if (!placed) {
        for (let r = 1; r < 20; r++) {
          let found = false;
          for (let dx = -r; dx <= r && !found; dx++) {
            for (let dy = -r; dy <= r && !found; dy++) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
              const gx = parentGrid.gx + dx;
              const gy = parentGrid.gy + dy;
              const key = gridKey(gx, gy);
              if (!occupied.has(key)) {
                occupied.add(key);
                gridPos.set(childSlug, { gx, gy });
                positions.set(childSlug, {
                  x: cx + gx * GRID_X,
                  y: cy + gy * GRID_Y,
                });
                visited.add(childSlug);
                queue.push(childSlug);
                found = true;
              }
            }
          }
          if (found) break;
        }
      }
    }
  }

  // Handle disconnected nodes
  for (const loc of locations) {
    if (!visited.has(loc.slug)) {
      for (let r = 1; r < 20; r++) {
        let found = false;
        for (let dx = -r; dx <= r && !found; dx++) {
          for (let dy = -r; dy <= r && !found; dy++) {
            const key = gridKey(dx, dy);
            if (!occupied.has(key)) {
              occupied.add(key);
              positions.set(loc.slug, {
                x: cx + dx * GRID_X,
                y: cy + dy * GRID_Y,
              });
              found = true;
            }
          }
        }
        if (found) break;
      }
    }
  }

  return positions;
}

/**
 * Metro-style routing between two points.
 * Returns waypoints using horizontal/vertical segments + 45° diagonals.
 */
function metroRoute(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number }[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  // Nearly aligned — straight line
  if (adx < 2 || ady < 2) {
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }

  const signX = Math.sign(dx);
  const signY = Math.sign(dy);
  const diag = Math.min(adx, ady);

  if (adx >= ady) {
    // Horizontal first, then 45° diagonal to destination
    const straightLen = adx - diag;
    return [
      { x: x1, y: y1 },
      { x: x1 + signX * straightLen, y: y1 },
      { x: x2, y: y2 },
    ];
  } else {
    // Vertical first, then 45° diagonal to destination
    const straightLen = ady - diag;
    return [
      { x: x1, y: y1 },
      { x: x1, y: y1 + signY * straightLen },
      { x: x2, y: y2 },
    ];
  }
}

export function WorldMap({
  seriesId,
  clusters,
  locations,
  defaultLocation,
  onSelectLocation,
}: WorldMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imagesLoaded, setImagesLoaded] = useState(0);

  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.slug, l])),
    [locations],
  );

  const locToCluster = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clusters) {
      for (const slug of c.locations) {
        map.set(slug, c.id);
      }
    }
    return map;
  }, [clusters]);

  // Build color lookup from cluster data
  const clusterColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clusters) {
      if (c.color) map.set(c.id, c.color);
    }
    return map;
  }, [clusters]);

  const getColor = useCallback(
    (clusterId: string) => clusterColorMap.get(clusterId) || NEUTRAL_COLOR,
    [clusterColorMap],
  );

  const getColorDim = useCallback(
    (clusterId: string) => {
      const c = clusterColorMap.get(clusterId);
      if (!c) return "rgba(148, 163, 184, 0.15)";
      return hexToRgba(c, 0.15);
    },
    [clusterColorMap],
  );

  // Identify interchange stations (connected to nodes in different clusters)
  const interchangeSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const loc of locations) {
      const myCluster = locToCluster.get(loc.slug);
      for (const conn of loc.connections) {
        const theirCluster = locToCluster.get(conn.target);
        if (myCluster && theirCluster && myCluster !== theirCluster) {
          set.add(loc.slug);
          set.add(conn.target);
        }
      }
    }
    return set;
  }, [locations, locToCluster]);

  // Build unique connection edges
  const connectionEdges = useMemo(() => {
    const edges: { a: WorldMapLocation; b: WorldMapLocation; label: string }[] = [];
    const seen = new Set<string>();
    for (const loc of locations) {
      for (const conn of loc.connections) {
        const key = [loc.slug, conn.target].sort().join("-");
        if (seen.has(key)) continue;
        seen.add(key);
        const target = locationMap.get(conn.target);
        if (target) edges.push({ a: loc, b: target, label: conn.label });
      }
    }
    return edges;
  }, [locations, locationMap]);

  // Compute metro layout
  const nodePositions = useMemo(() => {
    const cx = canvasSize.width / 2;
    const cy = canvasSize.height / 2;
    return computeMetroLayout(locations, defaultLocation, cx, cy);
  }, [locations, defaultLocation, canvasSize.width, canvasSize.height]);

  const getNodePos = useCallback(
    (slug: string) => nodePositions.get(slug) || { x: 0, y: 0 },
    [nodePositions],
  );

  // Preload location images for tooltips
  useEffect(() => {
    let loaded = 0;
    for (const loc of locations) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `/series/${seriesId}/world/locations/${loc.image}`;
      img.onload = () => {
        imagesRef.current.set(loc.slug, img);
        loaded++;
        if (loaded === locations.length) setImagesLoaded(loaded);
      };
      img.onerror = () => {
        loaded++;
        if (loaded === locations.length) setImagesLoaded(loaded);
      };
    }
  }, [locations, seriesId]);

  // Handle resize
  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    const updateSize = () => {
      setCanvasSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Canvas coordinate conversion
  const getMapCoords = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const w = rect.width;
      const h = rect.height;
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const mx = (sx - pan.x - w / 2) / zoom + w / 2;
      const my = (sy - pan.y - h / 2) / zoom + h / 2;
      return { mx, my };
    },
    [pan, zoom],
  );

  const getNodeAtPosition = useCallback(
    (clientX: number, clientY: number): WorldMapLocation | null => {
      const coords = getMapCoords(clientX, clientY);
      if (!coords) return null;
      for (const loc of locations) {
        const pos = getNodePos(loc.slug);
        const dx = coords.mx - pos.x;
        const dy = coords.my - pos.y;
        if (dx * dx + dy * dy < HIT_RADIUS * HIT_RADIUS) return loc;
      }
      return null;
    },
    [getMapCoords, locations, getNodePos],
  );

  // --- Draw ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, w, h);

    // Subtle ambient glow
    const ambientGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    ambientGrad.addColorStop(0, "rgba(139, 92, 246, 0.03)");
    ambientGrad.addColorStop(1, "transparent");
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, w, h);

    // Apply pan + zoom
    ctx.save();
    ctx.translate(pan.x + w / 2, pan.y + h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);

    // --- Cluster region shading ---
    for (const cluster of clusters) {
      const clusterNodes = cluster.locations
        .map((slug) => nodePositions.get(slug))
        .filter(Boolean) as { x: number; y: number }[];
      if (clusterNodes.length < 2) continue;

      const color = clusterColorMap.get(cluster.id) || NEUTRAL_COLOR;
      // Compute bounding center and max radius
      let avgX = 0, avgY = 0;
      for (const p of clusterNodes) { avgX += p.x; avgY += p.y; }
      avgX /= clusterNodes.length;
      avgY /= clusterNodes.length;
      let maxDist = 0;
      for (const p of clusterNodes) {
        const d = Math.sqrt((p.x - avgX) ** 2 + (p.y - avgY) ** 2);
        if (d > maxDist) maxDist = d;
      }
      const regionRadius = maxDist + GRID_X * 0.9;

      const regionGrad = ctx.createRadialGradient(
        avgX, avgY, 0,
        avgX, avgY, regionRadius,
      );
      regionGrad.addColorStop(0, hexToRgba(color, 0.08));
      regionGrad.addColorStop(0.7, hexToRgba(color, 0.03));
      regionGrad.addColorStop(1, "transparent");
      ctx.fillStyle = regionGrad;
      ctx.beginPath();
      ctx.arc(avgX, avgY, regionRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Connected slugs for hover highlighting
    const hoveredConnections = new Set<string>();
    if (hoveredSlug) {
      const loc = locationMap.get(hoveredSlug);
      if (loc) {
        for (const conn of loc.connections) {
          hoveredConnections.add(conn.target);
        }
      }
      // Also add reverse connections
      for (const l of locations) {
        for (const c of l.connections) {
          if (c.target === hoveredSlug) hoveredConnections.add(l.slug);
        }
      }
    }

    // --- Metro lines (connections) ---
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const edge of connectionEdges) {
      const { a, b } = edge;
      const posA = getNodePos(a.slug);
      const posB = getNodePos(b.slug);

      const clusterA = locToCluster.get(a.slug);
      const clusterB = locToCluster.get(b.slug);
      const bothNeutral = !clusterA && !clusterB;
      const sameFaction = clusterA && clusterB && clusterA === clusterB;
      const crossFaction = clusterA && clusterB && clusterA !== clusterB;
      // One neutral + one faction = gateway edge
      const gatewayEdge = (clusterA && !clusterB) || (!clusterA && clusterB);
      const factionColor = clusterA || clusterB;
      const isActive =
        hoveredSlug === a.slug || hoveredSlug === b.slug;
      const isDimmed = hoveredSlug && !isActive;

      // Determine line color
      let lineColor: string;
      if (sameFaction) {
        lineColor = getColor(clusterA!);
      } else if (bothNeutral) {
        lineColor = NEUTRAL_COLOR;
      } else if (gatewayEdge) {
        // Fade from neutral to faction color — use faction color
        lineColor = getColor(factionColor!);
      } else {
        lineColor = "#6b7280";
      }

      // Apply dimming/highlighting
      if (isDimmed) {
        if (sameFaction) {
          lineColor = getColorDim(clusterA!);
        } else if (bothNeutral) {
          lineColor = "rgba(148, 163, 184, 0.1)";
        } else {
          lineColor = "rgba(148, 163, 184, 0.1)";
        }
      } else if (isActive) {
        ctx.shadowColor = sameFaction
          ? getColor(clusterA!)
          : bothNeutral
            ? "rgba(148, 163, 184, 0.4)"
            : `rgba(148, 163, 184, 0.4)`;
        ctx.shadowBlur = 8;
      }

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = isActive ? LINE_WIDTH + 1 : LINE_WIDTH;

      if (crossFaction) {
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = isActive ? 3.5 : 2.5;
      } else if (gatewayEdge) {
        ctx.setLineDash([12, 4]);
        ctx.lineWidth = isActive ? LINE_WIDTH : LINE_WIDTH - 1;
      } else {
        ctx.setLineDash([]);
      }

      // Draw metro route
      const route = metroRoute(posA.x, posA.y, posB.x, posB.y);
      ctx.beginPath();
      ctx.moveTo(route[0].x, route[0].y);
      for (let i = 1; i < route.length; i++) {
        ctx.lineTo(route[i].x, route[i].y);
      }
      ctx.stroke();

      // Connection label on hover
      if (isActive && edge.label) {
        ctx.save();
        ctx.setLineDash([]);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        const midIdx = Math.floor(route.length / 2);
        const labelPt = route[midIdx];
        const labelX = midIdx === 0
          ? (route[0].x + route[route.length - 1].x) / 2
          : labelPt.x;
        const labelY = midIdx === 0
          ? (route[0].y + route[route.length - 1].y) / 2
          : labelPt.y;

        ctx.font = "500 9px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        const metrics = ctx.measureText(edge.label);
        const padX = 8;
        const padY = 4;

        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.beginPath();
        ctx.roundRect(
          labelX - metrics.width / 2 - padX,
          labelY - 24 - padY,
          metrics.width + padX * 2,
          16 + padY * 2,
          6,
        );
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fillText(edge.label, labelX, labelY - 14);
        ctx.restore();
      }

      // Reset shadow
      if (isActive) {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
    }
    ctx.setLineDash([]);

    // --- Station thumbnails ---
    for (const loc of locations) {
      const pos = getNodePos(loc.slug);
      const isHovered = hoveredSlug === loc.slug;
      const isConnected = hoveredConnections.has(loc.slug);
      const isDimmed = hoveredSlug && !isHovered && !isConnected;
      const isInterchange = interchangeSlugs.has(loc.slug);
      const clusterId = locToCluster.get(loc.slug) || "";
      const color = getColor(clusterId);
      const r = isInterchange ? INTERCHANGE_RADIUS : STATION_RADIUS;
      const stationR = isHovered ? r + 3 : r;
      const borderWidth = isHovered ? 3 : 2.5;
      const img = imagesRef.current.get(loc.slug);

      // Hover glow
      if (isHovered) {
        ctx.save();
        const glowGrad = ctx.createRadialGradient(
          pos.x, pos.y, stationR,
          pos.x, pos.y, stationR * 2.5,
        );
        glowGrad.addColorStop(0, `${color}50`);
        glowGrad.addColorStop(1, "transparent");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, stationR * 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Dark shadow ring for depth
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, stationR + borderWidth + 1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fill();

      // Colored border ring
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, stationR + borderWidth, 0, Math.PI * 2);
      ctx.fillStyle = isDimmed
        ? "rgba(60, 60, 80, 0.4)"
        : isHovered
          ? "#ffffff"
          : color;
      ctx.fill();

      // Clip and draw image thumbnail (or fallback)
      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, stationR, 0, Math.PI * 2);
      ctx.clip();

      if (img && img.complete && img.naturalWidth > 0) {
        // Draw image centered/cropped to fill circle
        const aspect = img.naturalWidth / img.naturalHeight;
        const drawSize = stationR * 2;
        let sw = drawSize, sh = drawSize;
        if (aspect > 1) sw = drawSize * aspect;
        else sh = drawSize / aspect;
        ctx.globalAlpha = isDimmed ? 0.2 : 1;
        ctx.drawImage(
          img,
          pos.x - sw / 2, pos.y - sh / 2,
          sw, sh,
        );
        ctx.globalAlpha = 1;
      } else {
        // Fallback: solid dark fill
        ctx.fillStyle = isDimmed ? "rgba(30, 30, 40, 0.8)" : "#1a1a2e";
        ctx.fill();
      }
      ctx.restore();

      // Subtle inner vignette on thumbnail
      if (!isDimmed) {
        ctx.save();
        const vignetteGrad = ctx.createRadialGradient(
          pos.x, pos.y, stationR * 0.5,
          pos.x, pos.y, stationR,
        );
        vignetteGrad.addColorStop(0, "transparent");
        vignetteGrad.addColorStop(1, "rgba(0, 0, 0, 0.35)");
        ctx.fillStyle = vignetteGrad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, stationR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Station label
      ctx.font = isHovered
        ? "600 11px system-ui"
        : "500 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      // Text shadow for readability
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = isDimmed
        ? "rgba(100, 116, 139, 0.3)"
        : isHovered
          ? "#ffffff"
          : isConnected
            ? "rgba(255, 255, 255, 0.85)"
            : "rgba(203, 213, 225, 0.65)";
      ctx.fillText(loc.name, pos.x, pos.y + stationR + 6);
      ctx.restore();
    }

    ctx.restore();

    // --- Fixed UI: Title ---
    ctx.font = "500 9px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(167, 139, 250, 0.5)";
    ctx.letterSpacing = "3px";
    ctx.fillText("EXPLORE", w / 2, 20);
    ctx.letterSpacing = "0px";

    ctx.font = "600 16px system-ui";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText("The Ninth Terrace", w / 2, 36);
  }, [
    canvasSize, pan, zoom, hoveredSlug, imagesLoaded, locations,
    connectionEdges, locToCluster, clusters, getNodePos,
    locationMap, interchangeSlugs, nodePositions, clusterColorMap,
  ]);

  // --- Interaction handlers ---
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isPanning) {
        setPan((p) => ({
          x: p.x + e.clientX - lastMouse.x,
          y: p.y + e.clientY - lastMouse.y,
        }));
        setLastMouse({ x: e.clientX, y: e.clientY });
      } else {
        const node = getNodeAtPosition(e.clientX, e.clientY);
        setHoveredSlug(node?.slug || null);
        if (node) {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }
        }
        if (canvasRef.current) {
          canvasRef.current.style.cursor = node ? "pointer" : "grab";
        }
      }
    },
    [isPanning, lastMouse, getNodeAtPosition],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const node = getNodeAtPosition(e.clientX, e.clientY);
      if (node) {
        onSelectLocation(node.slug);
      } else {
        setIsPanning(true);
        setLastMouse({ x: e.clientX, y: e.clientY });
        if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
      }
    },
    [getNodeAtPosition, onSelectLocation],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor)));
    },
    [],
  );

  // Touch support
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchRef = useRef<number | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const node = getNodeAtPosition(t.clientX, t.clientY);
        if (node) {
          onSelectLocation(node.slug);
        } else {
          lastTouchRef.current = { x: t.clientX, y: t.clientY };
        }
      }
    },
    [getNodeAtPosition, onSelectLocation],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.touches.length === 1 && lastTouchRef.current) {
        const t = e.touches[0];
        setPan((p) => ({
          x: p.x + t.clientX - lastTouchRef.current!.x,
          y: p.y + t.clientY - lastTouchRef.current!.y,
        }));
        lastTouchRef.current = { x: t.clientX, y: t.clientY };
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (lastPinchRef.current !== null) {
          const factor = dist / lastPinchRef.current;
          setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor)));
        }
        lastPinchRef.current = dist;
      }
    },
    [],
  );

  const handleTouchEnd = useCallback(() => {
    lastTouchRef.current = null;
    lastPinchRef.current = null;
  }, []);

  // Hovered location for tooltip
  const hoveredLoc = hoveredSlug ? locationMap.get(hoveredSlug) : null;
  const hoveredCluster = hoveredSlug
    ? clusters.find((c) => c.id === locToCluster.get(hoveredSlug))
    : null;

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", touchAction: "none" }}
        className="absolute inset-0 z-10 cursor-grab"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Hover tooltip with image */}
      {hoveredLoc && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: hoverPos.x + 20,
            top: hoverPos.y - 12,
            maxWidth: 280,
          }}
        >
          <div className="bg-black/90 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl overflow-hidden">
            {/* Location thumbnail */}
            <div className="w-full h-24 relative overflow-hidden">
              <img
                src={`/series/${seriesId}/world/locations/${hoveredLoc.image}`}
                alt={hoveredLoc.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: getColor(
                      locToCluster.get(hoveredLoc.slug) || "",
                    ),
                  }}
                />
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  {hoveredCluster?.name || "Unknown"}
                </span>
              </div>
              <p className="text-sm font-medium text-white">
                {hoveredLoc.name}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                {hoveredLoc.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metro line legend */}
      <div className="absolute bottom-6 left-6 z-30 flex flex-col gap-1.5">
        {clusters.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <div
              className="w-5 h-1 rounded-full"
              style={{ backgroundColor: getColor(c.id) }}
            />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
              {c.name}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-1 rounded-full"
            style={{ backgroundColor: NEUTRAL_COLOR }}
          />
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
            Neutral
          </span>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-1">
        <button
          className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-black/70 flex items-center justify-center text-lg transition-colors"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.3))}
        >
          +
        </button>
        <button
          className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-black/70 flex items-center justify-center text-lg transition-colors"
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z * 0.75))}
        >
          −
        </button>
        <button
          className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-black/70 flex items-center justify-center text-[10px] transition-colors"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          1:1
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { WorldMapLocation, WorldMapCluster } from "@/lib/world-types";

export interface CharacterOnMap {
  slug: string;
  name: string;
  locationSlug: string;
  image?: string; // URL to avatar
  mood?: string;
  isPlayer?: boolean;
}

export interface MovingCharacterInfo {
  slug: string;
  fromLocation: string;
  toLocation: string;
}

interface WorldMapProps {
  seriesId: string;
  clusters: WorldMapCluster[];
  locations: WorldMapLocation[];
  defaultLocation: string;
  onSelectLocation: (slug: string) => void;
  characters?: CharacterOnMap[];
  focusLocation?: string | null;
  highlightCharacter?: string | null;
  movingCharacters?: MovingCharacterInfo[];
}

// Metro map constants
const HIT_RADIUS = 30;
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
 * BFS layout on a hexagonal grid (pointy-top, axial coordinates).
 * 6 equidistant directions instead of 8 — produces cleaner spacing
 * and naturally supports hub nodes with many connections.
 * Deterministic via slug-seeded rotation.
 *
 * Axial hex directions (q, r):
 *   E (+1,0)  NE (+1,-1)  NW (0,-1)  W (-1,0)  SW (-1,+1)  SE (0,+1)
 */

const HEX_DIRECTIONS: [number, number][] = [
  [1, 0],   // E
  [1, -1],  // NE
  [0, -1],  // NW
  [-1, 0],  // W
  [-1, 1],  // SW
  [0, 1],   // SE
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Convert axial hex (q, r) to isometric screen coordinates.
 *  Classic isometric: x maps diag-right, r maps diag-left, y is squished. */
function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const TILE_W = size * 1.8;
  const TILE_H = size * 0.9;
  return {
    x: (q - r) * TILE_W / 2,
    y: (q + r) * TILE_H / 2,
  };
}

interface HexLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  hexCoords: Map<string, { q: number; r: number }>;
}

function computeHexLayout(
  locations: WorldMapLocation[],
  rootSlug: string,
  cx: number,
  cy: number,
): HexLayoutResult {
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

  const hexKey = (q: number, r: number) => `${q},${r}`;
  const HEX_SIZE = 100; // spacing between hex centers

  const toPixel = (q: number, r: number) => {
    const p = hexToPixel(q, r, HEX_SIZE);
    return { x: cx + p.x, y: cy + p.y };
  };

  const rootPixel = toPixel(0, 0);
  positions.set(rootSlug, rootPixel);
  occupied.add(hexKey(0, 0));
  const gridPos = new Map<string, { q: number; r: number }>();
  gridPos.set(rootSlug, { q: 0, r: 0 });

  const queue: string[] = [rootSlug];
  const visited = new Set<string>([rootSlug]);

  while (queue.length > 0) {
    const parentSlug = queue.shift()!;
    const parentHex = gridPos.get(parentSlug)!;
    const neighbors = adjacency.get(parentSlug);
    if (!neighbors) continue;

    const unplaced = Array.from(neighbors).filter((n) => !visited.has(n));
    if (unplaced.length === 0) continue;

    // Find directions already used by placed neighbors
    const usedDirs = new Set<number>();
    Array.from(neighbors).forEach((n) => {
      const ng = gridPos.get(n);
      if (!ng) return;
      const dq = ng.q - parentHex.q;
      const dr = ng.r - parentHex.r;
      const dirIdx = HEX_DIRECTIONS.findIndex(
        ([a, b]) => Math.sign(dq) === a && Math.sign(dr) === b,
      );
      if (dirIdx >= 0) usedDirs.add(dirIdx);
    });

    // Prioritize unused directions, then used ones
    const availableDirs: number[] = [];
    for (let i = 0; i < 6; i++) {
      if (!usedDirs.has(i)) availableDirs.push(i);
    }
    for (let i = 0; i < 6; i++) {
      if (usedDirs.has(i)) availableDirs.push(i);
    }

    const parentSeed = hashSlug(parentSlug);
    const startOffset = parentSeed % 6;

    for (let ci = 0; ci < unplaced.length; ci++) {
      const childSlug = unplaced[ci];
      const sectorSize = Math.max(1, Math.floor(availableDirs.length / unplaced.length));
      const primaryIdx = (ci * sectorSize + startOffset) % availableDirs.length;

      // Build ordered direction list spiralling out from primary
      const orderedDirs: number[] = [];
      for (let offset = 0; offset < 6; offset++) {
        const left = (primaryIdx + offset) % availableDirs.length;
        const right = (primaryIdx - offset + availableDirs.length) % availableDirs.length;
        if (!orderedDirs.includes(availableDirs[left])) {
          orderedDirs.push(availableDirs[left]);
        }
        if (!orderedDirs.includes(availableDirs[right])) {
          orderedDirs.push(availableDirs[right]);
        }
      }

      let placed = false;
      for (const dirIdx of orderedDirs) {
        const [dq, dr] = HEX_DIRECTIONS[dirIdx];
        for (let dist = 1; dist <= 4; dist++) {
          const q = parentHex.q + dq * dist;
          const r = parentHex.r + dr * dist;
          const key = hexKey(q, r);
          if (!occupied.has(key)) {
            occupied.add(key);
            gridPos.set(childSlug, { q, r });
            positions.set(childSlug, toPixel(q, r));
            visited.add(childSlug);
            queue.push(childSlug);
            placed = true;
            break;
          }
        }
        if (placed) break;
      }

      // Fallback: spiral outward from parent
      if (!placed) {
        for (let ring = 1; ring < 20 && !placed; ring++) {
          // Walk hex ring at distance `ring`
          let hq = parentHex.q + HEX_DIRECTIONS[4][0] * ring;
          let hr = parentHex.r + HEX_DIRECTIONS[4][1] * ring;
          for (let side = 0; side < 6 && !placed; side++) {
            for (let step = 0; step < ring && !placed; step++) {
              const key = hexKey(hq, hr);
              if (!occupied.has(key)) {
                occupied.add(key);
                gridPos.set(childSlug, { q: hq, r: hr });
                positions.set(childSlug, toPixel(hq, hr));
                visited.add(childSlug);
                queue.push(childSlug);
                placed = true;
              }
              hq += HEX_DIRECTIONS[side][0];
              hr += HEX_DIRECTIONS[side][1];
            }
          }
        }
      }
    }
  }

  // Handle disconnected nodes
  for (const loc of locations) {
    if (!visited.has(loc.slug)) {
      for (let ring = 1; ring < 20; ring++) {
        let found = false;
        let hq = HEX_DIRECTIONS[4][0] * ring;
        let hr = HEX_DIRECTIONS[4][1] * ring;
        for (let side = 0; side < 6 && !found; side++) {
          for (let step = 0; step < ring && !found; step++) {
            const key = hexKey(hq, hr);
            if (!occupied.has(key)) {
              occupied.add(key);
              positions.set(loc.slug, toPixel(hq, hr));
              found = true;
            }
            hq += HEX_DIRECTIONS[side][0];
            hr += HEX_DIRECTIONS[side][1];
          }
        }
        if (found) break;
      }
    }
  }

  return { positions, hexCoords: gridPos };
}

export function WorldMap({
  seriesId,
  clusters,
  locations,
  defaultLocation,
  onSelectLocation,
  characters = [],
  focusLocation = null,
  highlightCharacter = null,
  movingCharacters = [],
}: WorldMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const animFrameRef = useRef<number>(0);
  const animTimeRef = useRef<number>(0);

  // Character movement animation
  const moveProgressRef = useRef<number>(1); // 0→1, starts at 1 (complete)
  const moveStartTimeRef = useRef<number>(0);
  const MOVE_DURATION = 1800; // ms

  // Reset move animation when movingCharacters changes
  const movingKeyRef = useRef("");
  useEffect(() => {
    const key = movingCharacters.map((m) => `${m.slug}:${m.fromLocation}-${m.toLocation}`).join("|");
    if (key && key !== movingKeyRef.current) {
      moveProgressRef.current = 0;
      moveStartTimeRef.current = performance.now();
    } else if (!key) {
      moveProgressRef.current = 1;
    }
    movingKeyRef.current = key;
  }, [movingCharacters]);

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

  // Build directed outgoing connections for hover path display
  const outgoingEdges = useMemo(() => {
    const map = new Map<string, { target: string; label: string }[]>();
    for (const loc of locations) {
      map.set(loc.slug, loc.connections.map((c) => ({ target: c.target, label: c.label })));
    }
    return map;
  }, [locations]);

  // Compute hex layout
  const hexLayout = useMemo(() => {
    const cx = canvasSize.width / 2;
    const cy = canvasSize.height / 2;
    return computeHexLayout(locations, defaultLocation, cx, cy);
  }, [locations, defaultLocation, canvasSize.width, canvasSize.height]);

  const nodePositions = hexLayout.positions;
  const hexCoords = hexLayout.hexCoords;

  // Reverse map: hex key → slug (for tile image lookup)
  const hexKeyToSlug = useMemo(() => {
    const map = new Map<string, string>();
    hexCoords.forEach(({ q, r }, slug) => {
      map.set(`${q},${r}`, slug);
    });
    return map;
  }, [hexCoords]);

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

  // Preload character avatar images
  const charImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [charImagesLoaded, setCharImagesLoaded] = useState(0);

  useEffect(() => {
    if (characters.length === 0) return;
    let loaded = 0;
    for (const char of characters) {
      if (!char.image || charImagesRef.current.has(char.slug)) {
        loaded++;
        continue;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = char.image;
      img.onload = () => {
        charImagesRef.current.set(char.slug, img);
        loaded++;
        if (loaded === characters.length) setCharImagesLoaded(loaded);
      };
      img.onerror = () => {
        loaded++;
        if (loaded === characters.length) setCharImagesLoaded(loaded);
      };
    }
  }, [characters]);

  // Group characters by location for rendering
  const charactersByLocation = useMemo(() => {
    const map = new Map<string, CharacterOnMap[]>();
    for (const char of characters) {
      const list = map.get(char.locationSlug) || [];
      list.push(char);
      map.set(char.locationSlug, list);
    }
    return map;
  }, [characters]);

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

  // --- Draw (with animation loop for hover arcs) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const draw = () => {
    animTimeRef.current = (performance.now() / 1000) % 100;

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

    // Connected slugs for hover highlighting (computed early for tile dimming)
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

    // --- Isometric grid with location image tiles ---
    {
      const ISO_SIZE = 100;
      const tileW = ISO_SIZE * 1.8;
      const tileH = ISO_SIZE * 0.9;
      const gridCx = w / 2;
      const gridCy = h / 2;
      const extent = 14;
      const hw = tileW * 0.5;
      const hh = tileH * 0.5;

      // Helper: draw diamond path at pixel center
      const diamondPath = (cx2: number, cy2: number) => {
        ctx.beginPath();
        ctx.moveTo(cx2, cy2 - hh);
        ctx.lineTo(cx2 + hw, cy2);
        ctx.lineTo(cx2, cy2 + hh);
        ctx.lineTo(cx2 - hw, cy2);
        ctx.closePath();
      };

      for (let q = -extent; q <= extent; q++) {
        for (let r = -extent; r <= extent; r++) {
          const px = gridCx + (q - r) * tileW / 2;
          const py = gridCy + (q + r) * tileH / 2;
          const hexKey = `${q},${r}`;
          const locSlug = hexKeyToSlug.get(hexKey);
          const locData = locSlug ? locationMap.get(locSlug) : null;
          const img = locSlug ? imagesRef.current.get(locSlug) : null;
          const isHovered = locSlug === hoveredSlug;
          const isConnected = locSlug ? hoveredConnections.has(locSlug) : false;
          const isDimmed = hoveredSlug && !isHovered && !isConnected;

          if (locData && img && img.complete && img.naturalWidth > 0) {
            // --- Location tile: draw image clipped to diamond ---

            // Drop shadow for 3D depth
            ctx.save();
            diamondPath(px + 3, py + 5);
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fill();
            ctx.restore();

            // Colored border (faction color)
            const clusterId = locToCluster.get(locSlug!) || "";
            const color = getColor(clusterId);
            ctx.save();
            diamondPath(px, py);
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.strokeStyle = isHovered ? "#ffffff" : isDimmed ? "rgba(60, 60, 80, 0.4)" : color;
            ctx.stroke();
            ctx.restore();

            // Clip to diamond and draw image
            ctx.save();
            diamondPath(px, py);
            ctx.clip();

            const aspect = img.naturalWidth / img.naturalHeight;
            const drawW = tileW;
            const drawH = tileW / aspect;
            const finalW = drawH < tileH ? tileH * aspect : drawW;
            const finalH = drawH < tileH ? tileH : drawH;
            ctx.globalAlpha = isDimmed ? 0.15 : 1;
            ctx.drawImage(img, px - finalW / 2, py - finalH / 2, finalW, finalH);
            ctx.globalAlpha = 1;

            // Vignette overlay for depth
            const vigGrad = ctx.createRadialGradient(px, py, 0, px, py, hw);
            vigGrad.addColorStop(0, "transparent");
            vigGrad.addColorStop(0.7, "transparent");
            vigGrad.addColorStop(1, "rgba(0, 0, 0, 0.5)");
            ctx.fillStyle = vigGrad;
            diamondPath(px, py);
            ctx.fill();

            ctx.restore();

            // Hover glow
            if (isHovered) {
              ctx.save();
              diamondPath(px, py);
              ctx.shadowColor = color;
              ctx.shadowBlur = 16;
              ctx.strokeStyle = color;
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.shadowBlur = 0;
              ctx.restore();
            }
          } else if (locData) {
            // Location tile without loaded image — dark fill with border
            const clusterId = locToCluster.get(locSlug!) || "";
            const color = getColor(clusterId);
            diamondPath(px, py);
            ctx.fillStyle = isDimmed ? "rgba(15, 15, 25, 0.6)" : "rgba(20, 20, 35, 0.8)";
            ctx.fill();
            ctx.strokeStyle = isDimmed ? "rgba(60, 60, 80, 0.3)" : color;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else {
            // Empty grid tile — subtle checkerboard
            const isLight = (q + r) % 2 === 0;
            diamondPath(px, py);
            ctx.fillStyle = isLight ? "rgba(148, 163, 184, 0.02)" : "rgba(10, 10, 20, 0.2)";
            ctx.fill();
            ctx.strokeStyle = "rgba(148, 163, 184, 0.05)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

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
      const regionRadius = maxDist + 100 * 0.9;

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

    // --- 3D looping arc arrows (only on hover) ---
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (hoveredSlug) {
      const outs = outgoingEdges.get(hoveredSlug);
      if (outs) {
        const srcPos = getNodePos(hoveredSlug);
        const srcCluster = locToCluster.get(hoveredSlug) || "";
        const t = animTimeRef.current;

        for (const out of outs) {
          const dstPos = getNodePos(out.target);
          const dx = dstPos.x - srcPos.x;
          const dy = dstPos.y - srcPos.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) continue;

          const dstCluster = locToCluster.get(out.target) || "";
          const edgeColor = getColor(dstCluster || srcCluster);

          // Cubic bezier arc: lifts up in isometric "up" direction (screen -Y)
          const liftHeight = Math.min(len * 0.45, 80);
          const cp1x = srcPos.x + dx * 0.25;
          const cp1y = srcPos.y + dy * 0.25 - liftHeight;
          const cp2x = srcPos.x + dx * 0.75;
          const cp2y = srcPos.y + dy * 0.75 - liftHeight;

          // Draw arc shadow on ground plane
          ctx.save();
          ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(srcPos.x + 3, srcPos.y + 5);
          ctx.bezierCurveTo(
            cp1x + 3, cp1y + 5 + liftHeight * 0.7,
            cp2x + 3, cp2y + 5 + liftHeight * 0.7,
            dstPos.x + 3, dstPos.y + 5,
          );
          ctx.stroke();
          ctx.restore();

          // Draw the glowing arc path
          ctx.save();
          ctx.strokeStyle = edgeColor;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = edgeColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(srcPos.x, srcPos.y);
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, dstPos.x, dstPos.y);
          ctx.stroke();
          ctx.restore();

          // Animated flowing dashes along the arc
          ctx.save();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 14]);
          ctx.lineDashOffset = -t * 60;
          ctx.beginPath();
          ctx.moveTo(srcPos.x, srcPos.y);
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, dstPos.x, dstPos.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          // Animated orb traveling along the arc
          const orbT = (t * 0.8) % 1;
          const mt1 = 1 - orbT;
          const orbX = mt1*mt1*mt1*srcPos.x + 3*mt1*mt1*orbT*cp1x + 3*mt1*orbT*orbT*cp2x + orbT*orbT*orbT*dstPos.x;
          const orbY = mt1*mt1*mt1*srcPos.y + 3*mt1*mt1*orbT*cp1y + 3*mt1*orbT*orbT*cp2y + orbT*orbT*orbT*dstPos.y;

          ctx.save();
          const orbGrad = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, 6);
          orbGrad.addColorStop(0, "#ffffff");
          orbGrad.addColorStop(0.4, edgeColor);
          orbGrad.addColorStop(1, "transparent");
          ctx.fillStyle = orbGrad;
          ctx.beginPath();
          ctx.arc(orbX, orbY, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Arrowhead at destination
          // Tangent at t=1 of cubic bezier: 3*(P3 - P2)
          const tanX = 3 * (dstPos.x - cp2x);
          const tanY = 3 * (dstPos.y - cp2y);
          const tanLen = Math.sqrt(tanX * tanX + tanY * tanY);
          if (tanLen > 0) {
            const tnx = tanX / tanLen;
            const tny = tanY / tanLen;
            const perpX = -tny;
            const perpY = tnx;
            const arrowSize = 10;
            const tipX = dstPos.x;
            const tipY = dstPos.y;

            ctx.save();
            ctx.fillStyle = edgeColor;
            ctx.shadowColor = edgeColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(tipX - tnx * arrowSize + perpX * arrowSize * 0.5, tipY - tny * arrowSize + perpY * arrowSize * 0.5);
            ctx.lineTo(tipX - tnx * arrowSize * 0.6, tipY - tny * arrowSize * 0.6);
            ctx.lineTo(tipX - tnx * arrowSize - perpX * arrowSize * 0.5, tipY - tny * arrowSize - perpY * arrowSize * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }

          // Label at the arc peak
          if (out.label) {
            ctx.save();
            const labelX = (srcPos.x + dstPos.x) / 2;
            const labelY = (srcPos.y + dstPos.y) / 2 - liftHeight * 0.85;

            ctx.font = "500 9px system-ui";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            const metrics = ctx.measureText(out.label);
            const padX = 8;
            const padY = 4;

            ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
            ctx.beginPath();
            ctx.roundRect(
              labelX - metrics.width / 2 - padX,
              labelY - 16 - padY,
              metrics.width + padX * 2,
              16 + padY * 2,
              6,
            );
            ctx.fill();

            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
            ctx.fillText(out.label, labelX, labelY - 6);
            ctx.restore();
          }
        }
      }
    }

    // --- Station labels ---
    for (const loc of locations) {
      const pos = getNodePos(loc.slug);
      const isHovered = hoveredSlug === loc.slug;
      const isConnected = hoveredConnections.has(loc.slug);
      const isDimmed = hoveredSlug && !isHovered && !isConnected;

      ctx.font = isHovered
        ? "600 11px system-ui"
        : "500 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

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
      ctx.fillText(loc.name, pos.x, pos.y + 30);
      ctx.restore();
    }

    // --- Character avatars centered on tiles with depth ---
    const AVATAR_R = 20;
    const isHighlighting = !!highlightCharacter;

    // Update move animation progress
    const movingSlugs = new Set(movingCharacters.map((m) => m.slug));
    if (movingCharacters.length > 0 && moveProgressRef.current < 1) {
      const elapsed = performance.now() - moveStartTimeRef.current;
      const t = Math.min(elapsed / MOVE_DURATION, 1);
      // easeInOutCubic for smooth movement
      moveProgressRef.current = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    for (const [locSlug, chars] of Array.from(charactersByLocation.entries())) {
      const stationPos = getNodePos(locSlug);
      if (!stationPos) continue;

      // Filter out moving characters from normal rendering only while animation is active
      const isAnimating = movingSlugs.size > 0 && moveProgressRef.current < 1;
      const staticChars = isAnimating
        ? chars.filter((c) => !movingSlugs.has(c.slug))
        : chars;

      // Sort so player character renders on top (last), but highlighted char always on top
      const sorted = [...staticChars].sort((a, b) => {
        if (highlightCharacter) {
          if (a.slug === highlightCharacter) return 1;
          if (b.slug === highlightCharacter) return -1;
        }
        return (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0);
      });

      for (let i = 0; i < sorted.length; i++) {
        const char = sorted[i];
        const isActive = char.slug === highlightCharacter;
        // Stack characters with slight horizontal offset + vertical lift for depth
        const count = sorted.length;
        const spread = Math.min(count - 1, 4) * 14; // total horizontal spread
        const offsetX = count === 1 ? 0 : -spread / 2 + (i / (count - 1)) * spread;
        const offsetY = count === 1 ? 0 : (count - 1 - i) * 4; // back chars higher (further away)
        const ax = stationPos.x + offsetX;
        const ay = stationPos.y + offsetY;

        // Dim non-active characters during highlight
        if (isHighlighting && !isActive) {
          ctx.globalAlpha = 0.35;
        }

        // Ground shadow (isometric ellipse beneath avatar)
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ax + 3, ay + AVATAR_R + 4, AVATAR_R * 0.8, AVATAR_R * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.filter = "blur(3px)";
        ctx.fill();
        ctx.restore();

        // Outer glow ring for depth
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, AVATAR_R + 3, 0, Math.PI * 2);
        ctx.shadowColor = char.isPlayer ? "rgba(245, 158, 11, 0.6)" : "rgba(139, 92, 246, 0.4)";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fill();
        ctx.restore();

        // Border ring — gold for player, subtle gradient for NPCs
        ctx.beginPath();
        ctx.arc(ax, ay, AVATAR_R + 2, 0, Math.PI * 2);
        if (char.isPlayer) {
          const grad = ctx.createLinearGradient(ax, ay - AVATAR_R, ax, ay + AVATAR_R);
          grad.addColorStop(0, "#fbbf24");
          grad.addColorStop(1, "#b45309");
          ctx.fillStyle = grad;
        } else {
          const grad = ctx.createLinearGradient(ax, ay - AVATAR_R, ax, ay + AVATAR_R);
          grad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
          grad.addColorStop(1, "rgba(148, 163, 184, 0.6)");
          ctx.fillStyle = grad;
        }
        ctx.fill();

        // Avatar image or fallback
        const charImg = charImagesRef.current.get(char.slug);
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, AVATAR_R, 0, Math.PI * 2);
        ctx.clip();

        if (charImg && charImg.complete && charImg.naturalWidth > 0) {
          const aspect = charImg.naturalWidth / charImg.naturalHeight;
          const sz = AVATAR_R * 2;
          let sw = sz, sh = sz;
          if (aspect > 1) sw = sz * aspect;
          else sh = sz / aspect;
          ctx.drawImage(charImg, ax - sw / 2, ay - sh / 2, sw, sh);
        } else {
          // Fallback: colored circle with initial
          ctx.fillStyle = char.isPlayer ? "#92400e" : "#1e293b";
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 14px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(char.name.charAt(0).toUpperCase(), ax, ay);
        }
        ctx.restore();

        // Top highlight for 3D dome effect
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, AVATAR_R, 0, Math.PI * 2);
        ctx.clip();
        const highlight = ctx.createRadialGradient(
          ax - AVATAR_R * 0.3, ay - AVATAR_R * 0.3, 0,
          ax, ay, AVATAR_R
        );
        highlight.addColorStop(0, "rgba(255, 255, 255, 0.25)");
        highlight.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
        highlight.addColorStop(1, "rgba(0, 0, 0, 0.15)");
        ctx.fillStyle = highlight;
        ctx.fill();
        ctx.restore();

        // Pulsing highlight ring for active character
        if (isActive) {
          const pulse = 0.5 + 0.5 * Math.sin(animTimeRef.current * 4);
          ctx.save();
          ctx.beginPath();
          ctx.arc(ax, ay, AVATAR_R + 5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(251, 191, 36, ${0.4 + pulse * 0.4})`;
          ctx.lineWidth = 2;
          ctx.shadowColor = "rgba(251, 191, 36, 0.6)";
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.restore();
        }

        // Character name label
        ctx.save();
        ctx.font = "600 9px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 4;
        ctx.fillStyle = char.isPlayer ? "#fbbf24" : "rgba(255, 255, 255, 0.8)";
        ctx.fillText(char.name.split(" ")[0], ax, ay + AVATAR_R + 6);
        ctx.restore();

        // Reset alpha after dimming
        if (isHighlighting && !isActive) {
          ctx.globalAlpha = 1;
        }
      }
    }

    // --- Moving characters: interpolated positions between locations ---
    if (movingCharacters.length > 0 && moveProgressRef.current < 1) {
      const t = moveProgressRef.current;

      for (const mc of movingCharacters) {
        const fromPos = getNodePos(mc.fromLocation);
        const toPos = getNodePos(mc.toLocation);
        const charData = characters.find((c) => c.slug === mc.slug);
        if (!fromPos || !toPos || !charData) continue;

        // Cubic bezier-like arc: lift the character upward during mid-travel
        const liftHeight = Math.min(
          Math.sqrt((toPos.x - fromPos.x) ** 2 + (toPos.y - fromPos.y) ** 2) * 0.25,
          40,
        );
        const ax = fromPos.x + (toPos.x - fromPos.x) * t;
        const ay = fromPos.y + (toPos.y - fromPos.y) * t - Math.sin(t * Math.PI) * liftHeight;
        const isActive = charData.slug === highlightCharacter;

        // Trail particles
        if (t > 0.05 && t < 0.95) {
          for (let p = 0; p < 3; p++) {
            const pt = Math.max(0, t - (p + 1) * 0.08);
            const px = fromPos.x + (toPos.x - fromPos.x) * pt;
            const py = fromPos.y + (toPos.y - fromPos.y) * pt - Math.sin(pt * Math.PI) * liftHeight;
            const alpha = 0.3 - p * 0.1;
            ctx.save();
            ctx.beginPath();
            ctx.arc(px, py, AVATAR_R * (0.5 - p * 0.12), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
            ctx.fill();
            ctx.restore();
          }
        }

        // Ground shadow
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ax + 3, ay + AVATAR_R + 4, AVATAR_R * 0.8, AVATAR_R * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.filter = "blur(3px)";
        ctx.fill();
        ctx.restore();

        // Outer glow
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, AVATAR_R + 3, 0, Math.PI * 2);
        ctx.shadowColor = "rgba(251, 191, 36, 0.6)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fill();
        ctx.restore();

        // Border ring
        ctx.beginPath();
        ctx.arc(ax, ay, AVATAR_R + 2, 0, Math.PI * 2);
        const mGrad = ctx.createLinearGradient(ax, ay - AVATAR_R, ax, ay + AVATAR_R);
        mGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
        mGrad.addColorStop(1, "rgba(148, 163, 184, 0.6)");
        ctx.fillStyle = mGrad;
        ctx.fill();

        // Avatar image or fallback
        const charImg = charImagesRef.current.get(charData.slug);
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, AVATAR_R, 0, Math.PI * 2);
        ctx.clip();
        if (charImg && charImg.complete && charImg.naturalWidth > 0) {
          const aspect = charImg.naturalWidth / charImg.naturalHeight;
          const sz = AVATAR_R * 2;
          let sw = sz, sh = sz;
          if (aspect > 1) sw = sz * aspect;
          else sh = sz / aspect;
          ctx.drawImage(charImg, ax - sw / 2, ay - sh / 2, sw, sh);
        } else {
          ctx.fillStyle = "#1e293b";
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 14px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(charData.name.charAt(0).toUpperCase(), ax, ay);
        }
        ctx.restore();

        // 3D dome highlight
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, AVATAR_R, 0, Math.PI * 2);
        ctx.clip();
        const hl = ctx.createRadialGradient(ax - AVATAR_R * 0.3, ay - AVATAR_R * 0.3, 0, ax, ay, AVATAR_R);
        hl.addColorStop(0, "rgba(255, 255, 255, 0.25)");
        hl.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
        hl.addColorStop(1, "rgba(0, 0, 0, 0.15)");
        ctx.fillStyle = hl;
        ctx.fill();
        ctx.restore();

        // Pulsing gold ring during movement
        if (isActive) {
          const pulse = 0.5 + 0.5 * Math.sin(animTimeRef.current * 6);
          ctx.save();
          ctx.beginPath();
          ctx.arc(ax, ay, AVATAR_R + 5, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(251, 191, 36, ${0.5 + pulse * 0.5})`;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = "rgba(251, 191, 36, 0.8)";
          ctx.shadowBlur = 14;
          ctx.stroke();
          ctx.restore();
        }

        // Name label
        ctx.save();
        ctx.font = "600 9px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 4;
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fillText(charData.name.split(" ")[0], ax, ay + AVATAR_R + 6);
        ctx.restore();
      }
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

    // Continue animation loop when hovering or highlighting
    if ((hoveredSlug || highlightCharacter || (movingCharacters.length > 0 && moveProgressRef.current < 1)) && running) {
      animFrameRef.current = requestAnimationFrame(draw);
    }
    }; // end draw()

    draw();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    canvasSize, pan, zoom, hoveredSlug, highlightCharacter, movingCharacters, imagesLoaded, charImagesLoaded,
    locations, outgoingEdges, locToCluster, clusters, getNodePos,
    locationMap, interchangeSlugs, nodePositions, clusterColorMap,
    charactersByLocation, characters,
  ]);

  // --- Camera focus animation ---
  const focusAnimRef = useRef<number>(0);
  useEffect(() => {
    if (!focusLocation) return;
    const targetPos = nodePositions.get(focusLocation);
    if (!targetPos) return;

    const targetZoom = 1.6;
    const hw = canvasSize.width / 2;
    const hh = canvasSize.height / 2;
    // The draw transform is: translate(pan.x + hw, pan.y + hh) → scale(zoom) → translate(-hw, -hh)
    // To center world point (px, py) on screen, solve for pan:
    //   screenCenter = (worldPt - hw) * zoom + pan + hw  →  pan = -(worldPt - hw) * zoom
    const targetPanX = -(targetPos.x - hw) * targetZoom;
    const targetPanY = -(targetPos.y - hh) * targetZoom;

    const startPan = { ...pan };
    const startZoom = zoom;
    const duration = 1800;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

      setPan({
        x: startPan.x + (targetPanX - startPan.x) * ease,
        y: startPan.y + (targetPanY - startPan.y) * ease,
      });
      setZoom(startZoom + (targetZoom - startZoom) * ease);

      if (t < 1) focusAnimRef.current = requestAnimationFrame(animate);
    };
    focusAnimRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(focusAnimRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLocation, nodePositions, canvasSize]);

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

      {/* Metro line legend */}
      <div className="absolute top-6 right-6 z-30 flex flex-col gap-1.5">
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

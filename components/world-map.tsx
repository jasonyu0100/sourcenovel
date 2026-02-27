"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { WorldMapLocation, WorldMapCluster } from "@/lib/world-types";

interface WorldMapProps {
  seriesId: string;
  clusters: WorldMapCluster[];
  locations: WorldMapLocation[];
  onSelectLocation: (slug: string) => void;
}

// Force simulation node
interface SimNode {
  slug: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  cluster: string;
}

// Canvas constants
const NODE_RADIUS = 32;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

// Force constants
const REPULSION = 8000;
const SPRING_K = 0.015;
const SPRING_REST = 140;
const CLUSTER_GRAVITY = 0.008;
const CENTER_GRAVITY = 0.0005;
const DAMPING = 0.85;
const VELOCITY_THRESHOLD = 0.1;

const defaultBlobColor = { r: 139, g: 92, b: 246, a: 0.08 };

function parseRgba(str: string): { r: number; g: number; b: number; a: number } {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)\)/);
  if (!m) return defaultBlobColor;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] ? +m[4] : 1 };
}

export function WorldMap({
  seriesId,
  clusters,
  locations,
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
  const [simTick, setSimTick] = useState(0);

  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.slug, l])),
    [locations]
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

  // --- Force-directed simulation ---
  const nodesRef = useRef<Map<string, SimNode>>(new Map());
  const simRunningRef = useRef(true);
  const animFrameRef = useRef<number>(0);

  // Initialize simulation nodes
  useEffect(() => {
    const w = canvasSize.width || 800;
    const h = canvasSize.height || 600;
    const cx = w / 2;
    const cy = h / 2;

    // Spread clusters in a circle around center
    const clusterAngles = new Map<string, number>();
    clusters.forEach((c, i) => {
      clusterAngles.set(c.id, (i / clusters.length) * Math.PI * 2 - Math.PI / 2);
    });

    const nodes = new Map<string, SimNode>();
    for (const loc of locations) {
      const clusterId = locToCluster.get(loc.slug) || "";
      const angle = clusterAngles.get(clusterId) || 0;
      const clusterR = 150;
      const spread = 80;
      nodes.set(loc.slug, {
        slug: loc.slug,
        x: cx + Math.cos(angle) * clusterR + (Math.random() - 0.5) * spread,
        y: cy + Math.sin(angle) * clusterR + (Math.random() - 0.5) * spread,
        vx: 0,
        vy: 0,
        cluster: clusterId,
      });
    }
    nodesRef.current = nodes;
    simRunningRef.current = true;
  }, [locations, clusters, locToCluster]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run force simulation
  useEffect(() => {
    let running = true;

    const step = () => {
      if (!running) return;
      const nodes = nodesRef.current;
      if (nodes.size === 0) return;

      const w = canvasSize.width || 800;
      const h = canvasSize.height || 600;
      const cx = w / 2;
      const cy = h / 2;

      const arr = Array.from(nodes.values());

      // Compute cluster centroids
      const clusterSums = new Map<string, { sx: number; sy: number; n: number }>();
      for (const n of arr) {
        const s = clusterSums.get(n.cluster) || { sx: 0, sy: 0, n: 0 };
        s.sx += n.x;
        s.sy += n.y;
        s.n++;
        clusterSums.set(n.cluster, s);
      }

      // Reset forces
      const forces = new Map<string, { fx: number; fy: number }>();
      for (const n of arr) forces.set(n.slug, { fx: 0, fy: 0 });

      // Node-node repulsion
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i];
          const b = arr[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          forces.get(a.slug)!.fx -= fx;
          forces.get(a.slug)!.fy -= fy;
          forces.get(b.slug)!.fx += fx;
          forces.get(b.slug)!.fy += fy;
        }
      }

      // Edge spring attraction
      for (const edge of connectionEdges) {
        const a = nodes.get(edge.a.slug);
        const b = nodes.get(edge.b.slug);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const displacement = dist - SPRING_REST;
        const force = SPRING_K * displacement;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces.get(a.slug)!.fx += fx;
        forces.get(a.slug)!.fy += fy;
        forces.get(b.slug)!.fx -= fx;
        forces.get(b.slug)!.fy -= fy;
      }

      // Cluster gravity — pull toward cluster centroid
      for (const n of arr) {
        const s = clusterSums.get(n.cluster);
        if (!s || s.n < 2) continue;
        const ccx = s.sx / s.n;
        const ccy = s.sy / s.n;
        const f = forces.get(n.slug)!;
        f.fx += (ccx - n.x) * CLUSTER_GRAVITY;
        f.fy += (ccy - n.y) * CLUSTER_GRAVITY;
      }

      // Center gravity
      for (const n of arr) {
        const f = forces.get(n.slug)!;
        f.fx += (cx - n.x) * CENTER_GRAVITY;
        f.fy += (cy - n.y) * CENTER_GRAVITY;
      }

      // Apply forces with damping
      let maxV = 0;
      for (const n of arr) {
        const f = forces.get(n.slug)!;
        n.vx = (n.vx + f.fx) * DAMPING;
        n.vy = (n.vy + f.fy) * DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        maxV = Math.max(maxV, Math.abs(n.vx), Math.abs(n.vy));
      }

      setSimTick((t) => t + 1);

      if (maxV > VELOCITY_THRESHOLD && simRunningRef.current) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        simRunningRef.current = false;
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [canvasSize, connectionEdges]);

  // Get node position from simulation
  const getNodePos = useCallback(
    (slug: string) => {
      const n = nodesRef.current.get(slug);
      return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [simTick]
  );

  // Compute cluster blobs from sim positions
  const clusterBlobs = useMemo(() => {
    return clusters.map((cluster) => {
      const positions = cluster.locations
        .map((slug) => nodesRef.current.get(slug))
        .filter(Boolean)
        .map((n) => ({ x: n!.x, y: n!.y }));
      if (positions.length === 0) return { cluster, blob: null };

      const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
      const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
      const xExtent = Math.max(...positions.map((p) => Math.abs(p.x - cx)), 0);
      const yExtent = Math.max(...positions.map((p) => Math.abs(p.y - cy)), 0);
      const margin = NODE_RADIUS + 40;
      const rx = Math.max(xExtent + margin, margin);
      const ry = Math.max(yExtent + margin, margin);
      return { cluster, blob: { cx, cy, rx, ry } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, simTick]);

  // Preload location images
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
      setCanvasSize({ width: container.clientWidth, height: container.clientHeight });
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
    [pan, zoom]
  );

  const getNodeAtPosition = useCallback(
    (clientX: number, clientY: number): WorldMapLocation | null => {
      const coords = getMapCoords(clientX, clientY);
      if (!coords) return null;
      const hitRadius = NODE_RADIUS + 8;
      for (const loc of locations) {
        const pos = getNodePos(loc.slug);
        const dx = coords.mx - pos.x;
        const dy = coords.my - pos.y;
        if (dx * dx + dy * dy < hitRadius * hitRadius) return loc;
      }
      return null;
    },
    [getMapCoords, locations, getNodePos]
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

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, w, h);

    // Subtle ambient glow
    const ambientGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    ambientGrad.addColorStop(0, "rgba(139, 92, 246, 0.04)");
    ambientGrad.addColorStop(1, "transparent");
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, w, h);

    // Starfield
    const starSeed = [
      [0.1, 0.2, 0.3], [0.3, 0.6, 0.2], [0.5, 0.1, 0.25], [0.7, 0.4, 0.15],
      [0.9, 0.8, 0.2], [0.15, 0.9, 0.25], [0.85, 0.15, 0.2], [0.45, 0.75, 0.35],
      [0.25, 0.45, 0.15], [0.65, 0.25, 0.2], [0.35, 0.85, 0.18], [0.75, 0.55, 0.22],
      [0.55, 0.35, 0.12], [0.82, 0.72, 0.28], [0.18, 0.68, 0.16],
    ];
    for (const [sx, sy, alpha] of starSeed) {
      ctx.beginPath();
      ctx.arc(sx * w, sy * h, 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }

    // Apply pan + zoom transform
    ctx.save();
    ctx.translate(pan.x + w / 2, pan.y + h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);

    // Cluster that the hovered node belongs to
    const hoveredClusterId = hoveredSlug ? locToCluster.get(hoveredSlug) || null : null;

    // --- Cluster blobs ---
    for (const { cluster, blob } of clusterBlobs) {
      if (!blob) continue;
      const isActive = hoveredClusterId === cluster.id;
      const color = parseRgba(cluster.color || "");
      const opacity = isActive ? Math.min(color.a * 3, 0.3) : color.a;

      ctx.save();
      ctx.translate(blob.cx, blob.cy);
      const scaleX = blob.rx;
      const scaleY = blob.ry;
      ctx.scale(scaleX / 100, scaleY / 100);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 100);
      grad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 100, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Cluster label
      ctx.font = "600 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.13)";
      ctx.letterSpacing = "2px";
      ctx.fillText(
        cluster.name.toUpperCase(),
        blob.cx,
        blob.cy - blob.ry - 8
      );
    }

    // --- Connection edges ---
    for (const pass of ["intra", "cross"] as const) {
      for (const edge of connectionEdges) {
        const { a, b } = edge;
        const sameCluster = locToCluster.get(a.slug) === locToCluster.get(b.slug);
        if (pass === "intra" && !sameCluster) continue;
        if (pass === "cross" && sameCluster) continue;

        const isActive = hoveredSlug === a.slug || hoveredSlug === b.slug;
        const posA = getNodePos(a.slug);
        const posB = getNodePos(b.slug);
        const ax = posA.x;
        const ay = posA.y;
        const bx = posB.x;
        const by = posB.y;

        if (sameCluster) {
          ctx.setLineDash([]);
          ctx.lineWidth = isActive ? 2.5 : 1.5;
          ctx.strokeStyle = isActive
            ? "rgba(167, 139, 250, 0.5)"
            : "rgba(255, 255, 255, 0.07)";
        } else {
          ctx.setLineDash([8, 5]);
          ctx.lineWidth = isActive ? 3 : 2;
          ctx.strokeStyle = isActive
            ? "rgba(167, 139, 250, 0.6)"
            : "rgba(167, 139, 250, 0.12)";
        }

        if (isActive) {
          ctx.save();
          ctx.shadowColor = sameCluster
            ? "rgba(139, 92, 246, 0.3)"
            : "rgba(139, 92, 246, 0.5)";
          ctx.shadowBlur = sameCluster ? 6 : 10;
        }

        // Draw curved path
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        const dx = bx - ax;
        const dy = by - ay;
        const curvature = sameCluster ? 0.08 : 0.12;
        const midX = (ax + bx) / 2;
        const midY = (ay + by) / 2;
        const cpx = midX - dy * curvature;
        const cpy = midY + dx * curvature;
        ctx.quadraticCurveTo(cpx, cpy, bx, by);
        ctx.stroke();

        // Gateway diamond marker for cross-cluster connections
        if (!sameCluster && !isActive) {
          const mx = midX - (dy * curvature) / 2;
          const my = midY + (dx * curvature) / 2;
          ctx.save();
          ctx.setLineDash([]);
          ctx.translate(mx, my);
          ctx.rotate(Math.atan2(dy, dx));
          ctx.beginPath();
          ctx.moveTo(0, -4);
          ctx.lineTo(4, 0);
          ctx.lineTo(0, 4);
          ctx.lineTo(-4, 0);
          ctx.closePath();
          ctx.fillStyle = "rgba(167, 139, 250, 0.2)";
          ctx.fill();
          ctx.strokeStyle = "rgba(167, 139, 250, 0.3)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }

        // Connection label on hover
        if (isActive && edge.label) {
          ctx.save();
          ctx.setLineDash([]);
          const labelX = midX - (dy * curvature) / 2;
          const labelY = midY + (dx * curvature) / 2 - 10;
          ctx.font = "500 9px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          const metrics = ctx.measureText(edge.label);
          const padX = 6, padY = 3;
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
          ctx.beginPath();
          ctx.roundRect(
            labelX - metrics.width / 2 - padX,
            labelY - 10 - padY,
            metrics.width + padX * 2,
            14 + padY * 2,
            4
          );
          ctx.fill();
          ctx.fillStyle = "rgba(196, 181, 253, 0.9)";
          ctx.fillText(edge.label, labelX, labelY);
          ctx.restore();
        }

        if (isActive) ctx.restore();
      }
    }
    ctx.setLineDash([]);

    // --- Location nodes ---
    for (const loc of locations) {
      const pos = getNodePos(loc.slug);
      const lx = pos.x;
      const ly = pos.y;
      const isHovered = hoveredSlug === loc.slug;
      const isClusterActive = hoveredClusterId === locToCluster.get(loc.slug);
      const r = isHovered ? NODE_RADIUS + 4 : NODE_RADIUS;

      // Hover glow
      if (isHovered) {
        const glowGrad = ctx.createRadialGradient(lx, ly, r * 0.5, lx, ly, r * 2.5);
        glowGrad.addColorStop(0, "rgba(139, 92, 246, 0.25)");
        glowGrad.addColorStop(1, "transparent");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(lx, ly, r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dark backdrop
      ctx.beginPath();
      ctx.arc(lx, ly, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
      ctx.fill();

      // Border ring
      ctx.beginPath();
      ctx.arc(lx, ly, r, 0, Math.PI * 2);
      ctx.strokeStyle = isHovered
        ? "rgba(167, 139, 250, 0.8)"
        : isClusterActive
          ? "rgba(255, 255, 255, 0.2)"
          : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.stroke();

      // Clip and draw image
      const img = imagesRef.current.get(loc.slug);
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx, ly, r - 1, 0, Math.PI * 2);
      ctx.clip();

      if (img) {
        const aspect = img.width / img.height;
        let sw = r * 2, sh = r * 2;
        if (aspect > 1) sw = sh * aspect;
        else sh = sw / aspect;
        ctx.drawImage(img, lx - sw / 2, ly - sh / 2, sw, sh);
      } else {
        const fallbackGrad = ctx.createLinearGradient(lx - r, ly - r, lx + r, ly + r);
        fallbackGrad.addColorStop(0, "#1e293b");
        fallbackGrad.addColorStop(1, "#0f172a");
        ctx.fillStyle = fallbackGrad;
        ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
      }

      // Overlay gradient
      const overlayGrad = ctx.createLinearGradient(lx, ly - r, lx, ly + r);
      overlayGrad.addColorStop(0, "transparent");
      overlayGrad.addColorStop(
        1,
        isHovered ? "rgba(88, 28, 135, 0.5)" : "rgba(0, 0, 0, 0.3)"
      );
      ctx.fillStyle = overlayGrad;
      ctx.fillRect(lx - r, ly - r, r * 2, r * 2);

      ctx.restore();

      // Location label
      ctx.font = isHovered ? "600 11px system-ui" : "11px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = isHovered
        ? "rgba(196, 181, 253, 1)"
        : isClusterActive
          ? "rgba(203, 213, 225, 0.8)"
          : "rgba(100, 116, 139, 0.7)";
      ctx.fillText(loc.name, lx, ly + r + 6);
    }

    ctx.restore();

    // --- Fixed UI: Title ---
    ctx.font = "600 16px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText("The Ninth Terrace", w / 2, 36);
    ctx.font = "500 9px system-ui";
    ctx.fillStyle = "rgba(167, 139, 250, 0.6)";
    ctx.letterSpacing = "3px";
    ctx.fillText("EXPLORE", w / 2, 20);
  }, [
    canvasSize, pan, zoom, hoveredSlug, imagesLoaded, locations,
    connectionEdges, clusterBlobs, locToCluster, clusters, getNodePos,
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
    [isPanning, lastMouse, getNodeAtPosition]
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
    [getNodeAtPosition, onSelectLocation]
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
    []
  );

  // Touch support
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const node = getNodeAtPosition(t.clientX, t.clientY);
      if (node) {
        onSelectLocation(node.slug);
      } else {
        lastTouchRef.current = { x: t.clientX, y: t.clientY };
      }
    }
  }, [getNodeAtPosition, onSelectLocation]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
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
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastTouchRef.current = null;
    lastPinchRef.current = null;
  }, []);

  // Hovered location for tooltip
  const hoveredLoc = hoveredSlug ? locationMap.get(hoveredSlug) : null;

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

      {/* Hover tooltip */}
      {hoveredLoc && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: hoverPos.x + 16,
            top: hoverPos.y - 8,
            maxWidth: 240,
          }}
        >
          <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 shadow-xl">
            <p className="text-sm font-medium text-white">{hoveredLoc.name}</p>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
              {hoveredLoc.description}
            </p>
          </div>
        </div>
      )}

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

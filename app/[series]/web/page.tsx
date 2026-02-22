"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Bars3Icon,
  XMarkIcon,
  ShareIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { TreeNode, parseWebMd } from "./parseWebMd";
import { API_BASE } from "@/lib/constants";

// Chapter data structure for the viewer
interface Chapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  tree: TreeNode;
}

interface SeriesInfo {
  id: string;
  title: string;
}

// Depth colors for visual hierarchy
const depthColors = [
  "bg-violet-500",
  "bg-indigo-500",
  "bg-blue-500",
  "bg-sky-500",
  "bg-teal-500",
  "bg-emerald-500",
];

const depthHexColors = [
  "#a855f7",
  "#6366f1",
  "#3b82f6",
  "#0ea5e9",
  "#14b8a6",
  "#10b981",
];

const depthBorderColors = [
  "border-violet-500/30",
  "border-indigo-500/30",
  "border-blue-500/30",
  "border-sky-500/30",
  "border-teal-500/30",
  "border-emerald-500/30",
];

// Flatten tree with depth info
interface FlatNode {
  node: TreeNode;
  depth: number;
  path: string[];
  parentIndex: number | null;
}

function flattenWithDepth(node: TreeNode, depth = 0, path: string[] = [], parentIndex: number | null = null, startIndex = { value: 0 }): FlatNode[] {
  const currentPath = [...path, node.label];
  const myIndex = startIndex.value;
  startIndex.value++;
  const result: FlatNode[] = [{ node, depth, path: currentPath, parentIndex }];
  node.children?.forEach(child => {
    result.push(...flattenWithDepth(child, depth + 1, currentPath, myIndex, startIndex));
  });
  return result;
}

// Tree layout types
interface LayoutNode {
  flatIndex: number;
  x: number;
  y: number;
  depth: number;
  node: TreeNode;
}

export default function WebPage() {
  const params = useParams();
  const seriesId = params.series as string;
  const [series, setSeries] = useState<SeriesInfo | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'read' | 'tree'>('tree');
  const contentRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load series and chapters from web.md files
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch manifest to get series info and chapter list
        const manifestRes = await fetch(`${API_BASE}/${seriesId}/manifest.json`);
        if (!manifestRes.ok) throw new Error('Failed to load manifest');
        const manifest = await manifestRes.json();

        setSeries({ id: seriesId, title: manifest.title || seriesId });
        setBackgroundImage(`${API_BASE}/${seriesId}/background.jpg`);

        // Load web.md for each chapter
        const loadedChapters: Chapter[] = [];
        for (const ch of manifest.chapters) {
          try {
            const webRes = await fetch(`${API_BASE}/${seriesId}/chapters/${ch.number}/web.md`);
            if (webRes.ok) {
              const content = await webRes.text();
              const parsed = parseWebMd(content, ch.number);
              loadedChapters.push({
                id: `ch${ch.number}`,
                number: ch.number,
                title: parsed.meta.title || `Chapter ${ch.number}`,
                subtitle: parsed.meta.subtitle || '',
                tree: parsed.tree,
              });
            }
          } catch {
            console.warn(`Failed to load web.md for chapter ${ch.number}`);
          }
        }

        setChapters(loadedChapters);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [seriesId]);

  const chapter = chapters[currentChapter];
  const flatNodes = useMemo(
    () => chapter ? flattenWithDepth(chapter.tree) : [],
    [chapter]
  );
  const currentNode = flatNodes[currentIndex] || null;

  // Layout tree for canvas
  const layoutTree = useCallback(() => {
    if (flatNodes.length === 0) return [];

    const nodes: LayoutNode[] = [];
    const horizontalGap = 160;
    const verticalGap = 50;

    // Calculate subtree heights
    const getSubtreeHeight = (nodeIndex: number): number => {
      const node = flatNodes[nodeIndex];
      if (!node) return verticalGap;
      const children: number[] = [];
      for (let i = nodeIndex + 1; i < flatNodes.length; i++) {
        if (flatNodes[i].depth <= node.depth) break;
        if (flatNodes[i].depth === node.depth + 1) {
          children.push(i);
        }
      }
      if (children.length === 0) return verticalGap;
      return children.reduce((sum, childIdx) => sum + getSubtreeHeight(childIdx), 0);
    };

    const layoutNode = (nodeIndex: number, x: number, yStart: number, yEnd: number) => {
      const flatNode = flatNodes[nodeIndex];
      if (!flatNode) return;

      const y = (yStart + yEnd) / 2;

      nodes.push({
        flatIndex: nodeIndex,
        x,
        y,
        depth: flatNode.depth,
        node: flatNode.node,
      });

      // Find direct children
      const children: number[] = [];
      for (let i = nodeIndex + 1; i < flatNodes.length; i++) {
        if (flatNodes[i].depth <= flatNode.depth) break;
        if (flatNodes[i].depth === flatNode.depth + 1) {
          children.push(i);
        }
      }

      if (children.length > 0) {
        const childX = x + horizontalGap;
        const totalHeight = children.reduce((sum, idx) => sum + getSubtreeHeight(idx), 0);
        const availableHeight = yEnd - yStart;
        const scale = Math.min(1, availableHeight / totalHeight);

        let currentY = yStart + (availableHeight - totalHeight * scale) / 2;
        children.forEach(childIdx => {
          const childHeight = getSubtreeHeight(childIdx) * scale;
          layoutNode(childIdx, childX, currentY, currentY + childHeight);
          currentY += childHeight;
        });
      }
    };

    const totalHeight = getSubtreeHeight(0);
    layoutNode(0, 100, 50, 50 + totalHeight);

    return nodes;
  }, [flatNodes]);

  // Update layout when chapter changes
  useEffect(() => {
    setLayoutNodes(layoutTree());
  }, [layoutTree]);

  // Center on current node
  useEffect(() => {
    if (viewMode !== 'tree' || layoutNodes.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const current = layoutNodes.find(n => n.flatIndex === currentIndex);
    if (current && rect && rect.width > 0) {
      setPan({
        x: (rect.width / 2 - current.x) * zoom,
        y: (rect.height / 2 - current.y) * zoom,
      });
    }
  }, [currentIndex, layoutNodes, canvasSize, zoom, viewMode]);

  // Handle canvas resize
  useEffect(() => {
    if (viewMode !== 'tree') return;
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
  }, [viewMode]);

  // Draw canvas
  useEffect(() => {
    if (viewMode !== 'tree') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas (transparent to show background image behind)
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(pan.x + w / 2, pan.y + h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);

    // Build path to current node
    const pathToRoot = new Set<number>();
    let walker: number | null = currentIndex;
    while (walker !== null) {
      pathToRoot.add(walker);
      walker = flatNodes[walker]?.parentIndex ?? null;
    }

    // Draw edges
    layoutNodes.forEach(layoutNode => {
      const flatNode = flatNodes[layoutNode.flatIndex];
      if (!flatNode) return;
      const parentIdx = flatNode.parentIndex;
      if (parentIdx !== null) {
        const parent = layoutNodes.find(n => n.flatIndex === parentIdx);
        if (parent) {
          const onPath = pathToRoot.has(layoutNode.flatIndex) && pathToRoot.has(parentIdx);
          const isPast = layoutNode.flatIndex <= currentIndex;

          ctx.beginPath();
          ctx.moveTo(parent.x, parent.y);

          // Curved line
          const midX = (parent.x + layoutNode.x) / 2;
          ctx.bezierCurveTo(midX, parent.y, midX, layoutNode.y, layoutNode.x, layoutNode.y);

          ctx.strokeStyle = onPath
            ? 'rgba(139, 92, 246, 0.6)'
            : isPast
              ? 'rgba(100, 116, 139, 0.3)'
              : 'rgba(100, 116, 139, 0.15)';
          ctx.lineWidth = onPath ? 2.5 : 1.5;
          ctx.stroke();
        }
      }
    });

    // Draw nodes
    layoutNodes.forEach(layoutNode => {
      const isCurrent = layoutNode.flatIndex === currentIndex;
      const isPast = layoutNode.flatIndex < currentIndex;
      const onPath = pathToRoot.has(layoutNode.flatIndex);
      const isHovered = hoveredNode?.flatIndex === layoutNode.flatIndex;

      const baseRadius = Math.max(12, 28 - layoutNode.depth * 3);
      const radius = isCurrent || isHovered ? baseRadius + 4 : baseRadius;
      const color = depthHexColors[Math.min(layoutNode.depth, 5)];

      // Glow for current
      if (isCurrent) {
        const gradient = ctx.createRadialGradient(
          layoutNode.x, layoutNode.y, radius * 0.3,
          layoutNode.x, layoutNode.y, radius * 2.5
        );
        gradient.addColorStop(0, color + '50');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(layoutNode.x, layoutNode.y, radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dark backdrop for readability over background image
      ctx.beginPath();
      ctx.arc(layoutNode.x, layoutNode.y, radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 10, 15, 0.7)';
      ctx.fill();

      // Node circle
      ctx.beginPath();
      ctx.arc(layoutNode.x, layoutNode.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isCurrent
        ? color + '80'
        : onPath
          ? color + '60'
          : isPast
            ? color + '40'
            : color + '30';
      ctx.fill();
      ctx.strokeStyle = isCurrent
        ? color
        : onPath
          ? color + 'bb'
          : isPast
            ? color + '80'
            : color + '50';
      ctx.lineWidth = isCurrent ? 2.5 : isHovered ? 2 : 1.5;
      ctx.stroke();

      // Label
      const fontSize = layoutNode.depth <= 1 ? 11 : 10;
      ctx.font = isCurrent ? `600 ${fontSize}px system-ui` : `${fontSize}px system-ui`;
      ctx.fillStyle = isCurrent
        ? '#fff'
        : onPath
          ? 'rgba(255,255,255,0.95)'
          : isPast
            ? 'rgba(255,255,255,0.75)'
            : 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Word wrap
      const maxWidth = radius * 1.8;
      const words = layoutNode.node.label.split(' ');
      const lines: string[] = [];
      let line = words[0];
      for (let i = 1; i < words.length; i++) {
        const testLine = line + ' ' + words[i];
        if (ctx.measureText(testLine).width > maxWidth) {
          lines.push(line);
          line = words[i];
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      const lineHeight = fontSize + 2;
      const startY = layoutNode.y - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((l, i) => {
        ctx.fillText(l, layoutNode.x, startY + i * lineHeight);
      });
    });

    ctx.restore();
  }, [viewMode, layoutNodes, currentIndex, hoveredNode, canvasSize, pan, zoom, flatNodes]);

  // Canvas interaction handlers
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const w = rect.width;
    const h = rect.height;
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cx = (sx - pan.x - w / 2) / zoom + w / 2;
    const cy = (sy - pan.y - h / 2) / zoom + h / 2;
    return { cx, cy };
  };

  const getNodeAtPosition = (clientX: number, clientY: number): LayoutNode | null => {
    const coords = getCanvasCoords(clientX, clientY);
    if (!coords) return null;
    for (const node of layoutNodes) {
      const radius = Math.max(12, 28 - node.depth * 3) + 10;
      const dx = coords.cx - node.x;
      const dy = coords.cy - node.y;
      if (dx * dx + dy * dy < radius * radius) return node;
    }
    return null;
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPan(p => ({
        x: p.x + e.clientX - lastMouse.x,
        y: p.y + e.clientY - lastMouse.y,
      }));
      setLastMouse({ x: e.clientX, y: e.clientY });
    } else {
      const node = getNodeAtPosition(e.clientX, e.clientY);
      setHoveredNode(node);
      if (node) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
      }
      if (canvasRef.current) {
        canvasRef.current.style.cursor = node ? 'pointer' : 'grab';
      }
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = getNodeAtPosition(e.clientX, e.clientY);
    if (node) {
      setCurrentIndex(node.flatIndex);
    } else {
      setIsPanning(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hoveredNode ? 'pointer' : 'grab';
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(2, z * (e.deltaY > 0 ? 0.92 : 1.08))));
  };

  // Expand first layer (depth 0) by default when chapter loads
  useEffect(() => {
    if (flatNodes.length > 0) {
      const firstLayerIds = flatNodes
        .filter(fn => fn.depth === 0)
        .map(fn => fn.node.id);
      setExpandedSections(prev => {
        const next = new Set(prev);
        firstLayerIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [chapter?.id]);

  // Auto-expand sections to show current node in outline
  useEffect(() => {
    const pathIds = new Set<string>();
    let current = currentNode;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (flatNodes[i].depth < current.depth) {
        pathIds.add(flatNodes[i].node.id);
        current = flatNodes[i];
      }
    }
    setExpandedSections(prev => {
      const next = new Set(prev);
      pathIds.forEach(id => next.add(id));
      return next;
    });
  }, [currentIndex, flatNodes, currentNode]);

  // Scroll active item into view in outline
  useEffect(() => {
    if (outlineRef.current) {
      const activeItem = outlineRef.current.querySelector('[data-active="true"]');
      activeItem?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentIndex]);

  // Scroll content to top on node change
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentIndex]);

  const goNext = useCallback(() => {
    if (currentIndex < flatNodes.length - 1) {
      setCurrentIndex(i => i + 1);
    } else if (currentChapter < chapters.length - 1) {
      // Go to next chapter
      setCurrentChapter(c => c + 1);
      setCurrentIndex(0);
      setExpandedSections(new Set());
    }
  }, [currentIndex, flatNodes.length, currentChapter, chapters.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    } else if (currentChapter > 0) {
      // Go to previous chapter (last node)
      const prevChapterIndex = currentChapter - 1;
      const prevChapter = chapters[prevChapterIndex];
      if (prevChapter) {
        const prevFlatNodes = flattenWithDepth(prevChapter.tree);
        setCurrentChapter(prevChapterIndex);
        setCurrentIndex(prevFlatNodes.length - 1);
        setExpandedSections(new Set());
      }
    }
  }, [currentIndex, currentChapter, chapters]);

  const goToNode = useCallback((index: number) => {
    setCurrentIndex(index);
    setSidebarOpen(false);
  }, []);

  const changeChapter = useCallback((newChapter: number) => {
    setCurrentChapter(newChapter);
    setCurrentIndex(0);
    setExpandedSections(new Set());
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Search shortcut (⌘K or Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Don't handle navigation when typing in search
      if (document.activeElement === searchInputRef.current) {
        if (e.key === 'Escape') {
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
        return;
      }

      if (e.key === "ArrowRight" || e.key === " " || e.key === "j") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "k") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        setSidebarOpen(false);
      } else if (e.key === "t" || e.key === "T") {
        setViewMode(v => v === 'read' ? 'tree' : 'read');
      } else if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  // Touch swipe handling
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goPrev();
      else goNext();
    }
    touchStartX.current = null;
  };

  const toggleSection = (nodeId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Build outline tree structure
  const renderOutlineNode = (flatNode: FlatNode, index: number) => {
    const { node, depth } = flatNode;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedSections.has(node.id);
    const isActive = index === currentIndex;
    const isPast = index < currentIndex;

    let childCount = 0;
    if (hasChildren) {
      for (let i = index + 1; i < flatNodes.length; i++) {
        if (flatNodes[i].depth <= depth) break;
        if (flatNodes[i].depth === depth + 1) childCount++;
      }
    }

    return (
      <div key={node.id} className="select-none">
        <div
          data-active={isActive}
          className={`
            group flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all
            ${isActive
              ? 'bg-violet-500/20 text-white'
              : isPast
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }
          `}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => goToNode(index)}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSection(node.id);
              }}
              className="p-0.5 -ml-1 hover:bg-slate-700 rounded transition-colors"
            >
              <ChevronDownIcon
                className={`w-3.5 h-3.5 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
              />
            </button>
          )}
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${depthColors[Math.min(depth, 5)]}`} />
          <span className={`text-sm truncate ${isActive ? 'font-medium' : ''}`}>
            {node.label}
          </span>
          {hasChildren && !isExpanded && (
            <span className="text-xs text-slate-600 ml-auto">{childCount}</span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="relative">
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-slate-800"
              style={{ marginLeft: `${depth * 16 + 18}px` }}
            />
          </div>
        )}
      </div>
    );
  };

  // Filter nodes to show in outline (respect collapsed state)
  const getVisibleOutlineNodes = (): { flatNode: FlatNode; index: number }[] => {
    const result: { flatNode: FlatNode; index: number }[] = [];
    let skipUntilDepth = -1;

    flatNodes.forEach((flatNode, index) => {
      if (skipUntilDepth >= 0 && flatNode.depth > skipUntilDepth) {
        return;
      }
      skipUntilDepth = -1;

      result.push({ flatNode, index });

      const hasChildren = flatNode.node.children && flatNode.node.children.length > 0;
      if (hasChildren && !expandedSections.has(flatNode.node.id)) {
        skipUntilDepth = flatNode.depth;
      }
    });

    return result;
  };

  const progress = flatNodes.length > 0 ? ((currentIndex + 1) / flatNodes.length) * 100 : 0;

  // Highlight search terms in text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-400/80 text-black px-0.5 rounded">{part}</mark>
      ) : (
        part
      )
    );
  };

  // Search filtering
  const searchResults = searchQuery.trim().length > 0
    ? flatNodes
        .map((flatNode, index) => ({ flatNode, index }))
        .filter(({ flatNode }) => {
          const query = searchQuery.toLowerCase();
          const node = flatNode.node;
          return (
            node.label.toLowerCase().includes(query) ||
            node.description.toLowerCase().includes(query) ||
            (node.detail?.toLowerCase().includes(query) ?? false) ||
            (node.quote?.toLowerCase().includes(query) ?? false)
          );
        })
    : [];

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading chapters...</p>
        </div>
      </div>
    );
  }

  // Background style with image and overlay
  const backgroundStyle = backgroundImage ? {
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  } : {};

  // No chapters available - show interface shell with empty state
  if (chapters.length === 0 || !chapter) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col relative" style={backgroundStyle}>
        {/* Dark overlay */}
        {backgroundImage && <div className="fixed inset-0 bg-[#0a0a0f]/80 pointer-events-none z-0" />}
        <header className="sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link
              href={`/${seriesId}`}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm group"
            >
              <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              {series?.title || 'Home'}
            </Link>
          </div>
          <div className="h-0.5 bg-slate-800" />
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-12">
            <ShareIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No web content yet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex flex-col relative overflow-hidden" style={backgroundStyle}>
      {/* Dark overlay */}
      {backgroundImage && <div className="fixed inset-0 bg-[#0a0a0f]/80 pointer-events-none z-0" />}

      {/* Header */}
      <header className="flex-shrink-0 sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/${seriesId}`}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm group"
            >
              <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              {series?.title || 'Home'}
            </Link>

            <span className="text-slate-600">|</span>

            {/* Chapter selector */}
            <div className="relative group">
              <button className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
                <span className="font-medium">Ch. {chapter.number}</span>
                <ChevronDownIcon className="w-4 h-4" />
              </button>
              <div className="absolute top-full left-0 mt-2 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all min-w-[200px] z-50">
                {chapters.map((ch, i) => (
                  <button
                    key={ch.id}
                    onClick={() => changeChapter(i)}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      i === currentChapter
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-medium">Chapter {ch.number}:</span> {ch.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <button
              onClick={() => setViewMode(v => v === 'read' ? 'tree' : 'read')}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                viewMode === 'tree'
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ShareIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Tree</span>
            </button>

            <span className="text-sm text-slate-500 ml-2">
              <span className="text-slate-300">{currentIndex + 1}</span>
              <span className="mx-1">/</span>
              <span>{flatNodes.length}</span>
            </span>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-slate-400 hover:text-white transition-colors lg:hidden"
            >
              {sidebarOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Sidebar - Outline (hidden in tree mode on desktop) */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-30 w-80 bg-[#0a0a0f] border-r border-slate-800/50 transform transition-transform duration-300 overflow-hidden
            lg:relative lg:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <div className="flex flex-col h-full pt-16 lg:pt-0">
            {/* Chapter title in sidebar */}
            <div className="p-4 border-b border-slate-800/50">
              <h2 className="font-semibold text-white">{chapter.title}</h2>
              <p className="text-sm text-slate-500 mt-1">{chapter.subtitle}</p>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-800/50">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search nodes... (⌘K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Search Results or Outline */}
            <div ref={outlineRef} className="flex-1 overflow-y-auto p-2">
              {searchQuery.trim() ? (
                searchResults.length > 0 ? (
                  <div className="space-y-1">
                    <div className="px-3 py-2 text-xs text-slate-500">
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                    </div>
                    {searchResults.map(({ flatNode, index }) => (
                      <button
                        key={flatNode.node.id}
                        onClick={() => {
                          goToNode(index);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${depthColors[Math.min(flatNode.depth, 5)]}`} />
                          <span className="text-sm text-white font-medium truncate">{highlightText(flatNode.node.label, searchQuery)}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 pl-4">
                          {highlightText(flatNode.node.description, searchQuery)}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-slate-500">
                    No results for "{searchQuery}"
                  </div>
                )
              ) : (
                getVisibleOutlineNodes().map(({ flatNode, index }) =>
                  renderOutlineNode(flatNode, index)
                )
              )}
            </div>

            {/* Keyboard hints */}
            <div className="p-4 border-t border-slate-800/50 hidden lg:block">
              <div className="text-xs text-slate-600 space-y-1">
                <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">←</kbd> <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">→</kbd> navigate</div>
                <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">⌘K</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">/</kbd> search</div>
                <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">t</kbd> toggle tree view</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Tree visualization */}
          {viewMode === 'tree' && (
            <div className="flex-1 relative bg-[#0a0a0f]" style={backgroundImage ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
              {backgroundImage && <div className="absolute inset-0 bg-[#0a0a0f]/50 pointer-events-none" />}
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%' }}
                className="absolute inset-0 z-10 cursor-grab"
                onMouseMove={handleCanvasMouseMove}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => {
                  setHoveredNode(null);
                  setIsPanning(false);
                }}
                onWheel={handleCanvasWheel}
              />

              {/* Tree view hint */}
              <div className="absolute bottom-4 left-4 z-20 text-xs text-slate-600 hidden sm:block">
                <div>Click nodes to navigate</div>
                <div>Drag to pan • Scroll to zoom</div>
              </div>

              {/* Hover tooltip */}
              {hoveredNode && !isPanning && (() => {
                const hNode = flatNodes[hoveredNode.flatIndex];
                if (!hNode) return null;
                const tooltipW = 320;
                const tooltipH = 200;
                const pad = 16;
                // Position tooltip to the right of cursor, flip if near edge
                let left = hoverPos.x + pad;
                let top = hoverPos.y - 20;
                if (left + tooltipW > canvasSize.width) left = hoverPos.x - tooltipW - pad;
                if (top + tooltipH > canvasSize.height) top = canvasSize.height - tooltipH - pad;
                if (top < pad) top = pad;
                return (
                  <div
                    className="absolute z-20 w-80 bg-slate-900/95 backdrop-blur-sm border border-slate-700/80 rounded-xl shadow-2xl pointer-events-none overflow-hidden"
                    style={{ left, top }}
                  >
                    <div className="p-3 border-b border-slate-800/50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-2 h-2 rounded-full ${depthColors[Math.min(hNode.depth, 5)]}`} />
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Depth {hNode.depth}</span>
                        {hNode.node.children && hNode.node.children.length > 0 && (
                          <span className="text-[10px] text-slate-600">
                            · {hNode.node.children.length} {hNode.node.children.length === 1 ? 'child' : 'children'}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-white leading-tight">{hNode.node.label}</h3>
                    </div>
                    <div className="p-3 space-y-2">
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{hNode.node.description}</p>
                      {hNode.node.quote && (
                        <p className="text-xs text-slate-400 italic line-clamp-2">"{hNode.node.quote}"</p>
                      )}
                      {hNode.node.children && hNode.node.children.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {hNode.node.children.slice(0, 3).map((child) => (
                            <span key={child.id} className="text-[10px] px-2 py-0.5 bg-slate-800/60 text-slate-400 rounded-full truncate max-w-[120px]">
                              {child.label}
                            </span>
                          ))}
                          {hNode.node.children.length > 3 && (
                            <span className="text-[10px] text-slate-600">+{hNode.node.children.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Reading content */}
          {viewMode === 'read' && (
            <main
              ref={contentRef}
              className="flex-1 overflow-y-auto"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="max-w-2xl mx-auto px-6 py-8 lg:py-12">
                {/* Breadcrumb path */}
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 flex-wrap">
                  {currentNode.path.slice(0, -1).map((p, i) => (
                    <span key={i} className="flex items-center gap-2">
                      <span>{p}</span>
                      <span className="text-slate-700">›</span>
                    </span>
                  ))}
                </div>

                {/* Current node content */}
                <article>
                  {/* Header */}
                  <header className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-3 h-3 rounded-full ${depthColors[Math.min(currentNode.depth, 5)]}`} />
                      <span className="text-sm text-slate-500 uppercase tracking-wide">
                        Depth {currentNode.depth}
                      </span>
                    </div>
                    <h1 className="text-3xl lg:text-4xl font-bold text-white mb-4 leading-tight">
                      {currentNode.node.label}
                    </h1>
                    <p className="text-xl text-slate-300 leading-relaxed">
                      {currentNode.node.description}
                    </p>
                  </header>

                  {/* Detail section */}
                  {currentNode.node.detail && (
                    <div className={`mb-8 pl-5 border-l-2 ${depthBorderColors[Math.min(currentNode.depth, 5)]}`}>
                      <p className="text-base text-slate-400 leading-relaxed">
                        {currentNode.node.detail}
                      </p>
                    </div>
                  )}

                  {/* Quote section */}
                  {currentNode.node.quote && (
                    <blockquote className="relative my-8 py-4 px-6 bg-slate-900/50 rounded-lg border border-slate-800/50">
                      <div className="absolute -top-3 left-4 px-2 bg-[#0a0a0f] text-violet-400 text-sm">
                        From the chapter
                      </div>
                      <p className="text-lg text-slate-200 italic leading-relaxed">
                        "{currentNode.node.quote}"
                      </p>
                    </blockquote>
                  )}

                  {/* Children preview */}
                  {currentNode.node.children && currentNode.node.children.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-slate-800/50">
                      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
                        Explore deeper
                      </h3>
                      <div className="grid gap-3">
                        {currentNode.node.children.map((child) => {
                          const actualIndex = flatNodes.findIndex(f => f.node.id === child.id);
                          return (
                            <button
                              key={child.id}
                              onClick={() => goToNode(actualIndex)}
                              className="group flex items-start gap-4 p-4 bg-slate-900/50 hover:bg-slate-800/50 rounded-lg border border-slate-800/50 hover:border-slate-700/50 transition-all text-left"
                            >
                              <div className={`w-2 h-2 rounded-full mt-2 ${depthColors[Math.min(currentNode.depth + 1, 5)]}`} />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-white group-hover:text-violet-300 transition-colors">
                                  {child.label}
                                </h4>
                                <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                                  {child.description}
                                </p>
                              </div>
                              <ChevronRightIcon className="w-5 h-5 text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-1" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </article>
              </div>
            </main>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <nav className="sticky bottom-0 z-40 bg-[#0a0a0f]/95 backdrop-blur-sm border-t border-slate-800/50">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto lg:max-w-none lg:px-6">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {depthColors.slice(0, 6).map((color, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${color} ${
                    i === Math.min(currentNode.depth, 5) ? 'ring-2 ring-white ring-offset-1 ring-offset-[#0a0a0f]' : 'opacity-30'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={goNext}
            disabled={currentIndex === flatNodes.length - 1}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </nav>
    </div>
  );
}

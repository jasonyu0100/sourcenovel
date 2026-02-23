"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  DocumentTextIcon,
  UserCircleIcon,
  MapPinIcon,
  SparklesIcon,
  BookOpenIcon,
  FolderIcon,
  Bars3Icon,
  XMarkIcon,
  MusicalNoteIcon,
  VideoCameraIcon,
  SpeakerWaveIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import type { SeriesEntry } from "@/lib/types";
import {
  getSeriesEntry,
  getSourceFile,
  getContentManifest,
  type ContentManifest,
  type WorldEntry,
} from "@/lib/series";
import { MarkdownContent } from "@/components/markdown-content";
import { API_BASE } from "@/lib/constants";

// --- Types ---

interface FileItem {
  id: string;
  label: string;
  path: string;
  image?: string | null;
}

interface ChapterPageData {
  num: number;
  image: string; // relative path: chapters/{n}/pages/{p}/page.jpg
  panelFiles: string[]; // panel image filenames within the page directory
}

interface ChapterData {
  chapterNum: number;
  files: FileItem[];
  media: FileItem[];
  pages: ChapterPageData[];
}

interface ArcData {
  arcNum: number;
  files: FileItem[];
}

interface WorldCategoryData {
  id: string;
  label: string;
  icon: typeof UserCircleIcon;
  files: FileItem[];
}

// --- Constants ---

const FILE_LABELS: Record<string, string> = {
  "objective.md": "Objective",
  "concept.md": "Concept",
  "memory.md": "Memory",
  "route.md": "Route",
  "draft.md": "Draft",
  "review.md": "Review",
  "references.md": "References",
  "summary.md": "Summary",
  "arc.md": "Arc Overview",
  "formula.md": "Formula",
  "progress.md": "Progress",
  "protagonist.md": "Protagonist",
  "world.md": "World",
  "capabilities.md": "Capabilities",
  "characters.md": "Characters",
  "setting.md": "Setting",
  "writing-module.md": "Writing Module",
  "style-guide.md": "Style Guide",
  "series.md": "Series Info",
  "style.md": "Visual Style",
};

function getFileLabel(filename: string): string {
  return (
    FILE_LABELS[filename] ||
    filename
      .replace(/\.md$/, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
  );
}

type CategoryId = "world" | "chapters" | "arcs" | "sources" | "modules" | "meta";

const CATEGORIES: { id: CategoryId; label: string; dividerBefore?: boolean }[] = [
  { id: "world", label: "World" },
  { id: "chapters", label: "Chapters" },
  { id: "arcs", label: "Arcs" },
  { id: "sources", label: "Sources" },
  { id: "modules", label: "Modules" },
  { id: "meta", label: "Meta" },
];

const WORLD_CATEGORIES_DEF = [
  { id: "characters", label: "Characters", icon: UserCircleIcon },
  { id: "locations", label: "Locations", icon: MapPinIcon },
  { id: "elements", label: "Elements", icon: SparklesIcon },
];

// --- Component ---

export default function SourcesPage() {
  const params = useParams();
  const seriesId = params.series as string;

  const [entry, setEntry] = useState<SeriesEntry | null>(null);
  const [manifest, setManifest] = useState<ContentManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Navigation state
  const [activeCategory, setActiveCategory] = useState<CategoryId>("world");
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [activeFileImage, setActiveFileImage] = useState<string | null>(null);
  const [content, setContent] = useState("");

  // Data
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [arcs, setArcs] = useState<ArcData[]>([]);
  const [worldCategories, setWorldCategories] = useState<WorldCategoryData[]>([]);
  const [sources, setSources] = useState<FileItem[]>([]);
  const [modules, setModules] = useState<FileItem[]>([]);
  const [meta, setMeta] = useState<FileItem[]>([]);

  // Sidebar expand state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["characters"]));

  const contentRef = useRef<HTMLDivElement>(null);

  // Load data
  useEffect(() => {
    setBackgroundImage(`${API_BASE}/${seriesId}/background.jpg`);
    Promise.all([
      getContentManifest(seriesId),
      getSeriesEntry(seriesId),
    ]).then(([contentManifest, seriesEntry]) => {
      setManifest(contentManifest);
      setEntry(seriesEntry);
      setLoading(false);
    });
  }, [seriesId]);

  // Process manifest
  useEffect(() => {
    if (!manifest || !seriesId) return;

    // Chapters
    const chapterData: ChapterData[] = manifest.chapters.map((ch) => ({
      chapterNum: ch.number,
      files: ch.files.map((f) => ({
        id: `ch${ch.number}-${f.replace(/\.md$/, "")}`,
        label: getFileLabel(f),
        path: `chapters/${ch.number}/${f}`,
      })),
      media: (ch.media || []).map((f) => ({
        id: `ch${ch.number}-media-${f}`,
        label: f,
        path: `chapters/${ch.number}/media/${f}`,
      })),
      pages: (ch.pages || []).map((p) => {
        const isObj = typeof p === "object" && p !== null;
        const num = isObj ? p.number : p;
        return {
          num,
          image: `chapters/${ch.number}/pages/${num}/page.jpg`,
          panelFiles: isObj && Array.isArray(p.files) ? p.files : [],
        };
      }),
    }));
    setChapters(chapterData);

    // Arcs
    const arcData: ArcData[] = manifest.arcs.map((arc) => {
      const files: FileItem[] = [
        ...arc.files.map((f) => ({
          id: `arc${arc.number}-${f.replace(/\.md$/, "")}`,
          label: getFileLabel(f),
          path: `arcs/${arc.number}/${f}`,
        })),
        ...(arc.sources || []).map((f: string) => ({
          id: `arc${arc.number}-src-${f.replace(/\.md$/, "")}`,
          label: `Source: ${getFileLabel(f)}`,
          path: `sources/${arc.number}/${f}`,
        })),
      ];
      return { arcNum: arc.number, files };
    });
    setArcs(arcData);

    // Sources / modules / meta
    setSources(
      (manifest.sources || []).map((f: string) => ({
        id: `src-${f.replace(/\.md$/, "")}`,
        label: getFileLabel(f),
        path: `sources/${f}`,
      }))
    );
    setModules(
      (manifest.modules || []).map((f: string) => ({
        id: `mod-${f.replace(/\.md$/, "")}`,
        label: getFileLabel(f),
        path: `modules/${f}`,
      }))
    );
    setMeta(
      (manifest.meta || []).map((f: string) => ({
        id: `meta-${f.replace(/\.md$/, "")}`,
        label: getFileLabel(f),
        path: f,
      }))
    );

    // World
    if (manifest.world) {
      const worldData: WorldCategoryData[] = WORLD_CATEGORIES_DEF.map((cat) => ({
        id: cat.id,
        label: cat.label,
        icon: cat.icon,
        files: (manifest.world[cat.id as keyof typeof manifest.world] || []).map(
          (entry: WorldEntry) => ({
            id: `world-${cat.id}-${entry.file.replace(/\.md$/, "")}`,
            label: getFileLabel(entry.file),
            path: `world/${cat.id}/${entry.file}`,
            image: entry.image ? `world/${cat.id}/${entry.image}` : null,
          })
        ),
      }));
      setWorldCategories(worldData);

      // Auto-select first world entry
      const firstCat = worldData.find((c) => c.files.length > 0);
      if (firstCat && firstCat.files.length > 0) {
        const f = firstCat.files[0];
        setActiveFilePath(f.path);
        setActiveFileImage(f.image ? `${API_BASE}/${seriesId}/${f.image}` : null);
        setExpandedSections(new Set([firstCat.id]));
      }
    }
  }, [manifest, seriesId]);

  // Derive file type from active path
  const activeFileType = activeFilePath
    ? activeFilePath.endsWith(".mp3") ? "audio"
    : activeFilePath.endsWith(".mp4") ? "video"
    : activeFilePath.endsWith(".jpg") || activeFilePath.endsWith(".png") ? "image"
    : "text"
    : null;

  // Load content when active file changes (only for text files)
  useEffect(() => {
    if (!seriesId || !activeFilePath) return;
    const ext = activeFilePath.split(".").pop();
    if (ext === "mp3" || ext === "mp4" || ext === "jpg" || ext === "png") {
      setContent("__media__"); // signal that content is available but not text
      return;
    }
    setContent("");
    getSourceFile(seriesId, activeFilePath).then(setContent);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [seriesId, activeFilePath]);

  const selectFile = (file: FileItem) => {
    setActiveFilePath(file.path);
    setActiveFileImage(file.image && seriesId ? `${API_BASE}/${seriesId}/${file.image}` : null);
    setSidebarOpen(false);
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isActiveFile = (file: FileItem) => file.path === activeFilePath;

  // --- Sidebar rendering ---

  const renderWorldSidebar = () => (
    <div className="space-y-1">
      {worldCategories.map((cat) => {
        const isExpanded = expandedSections.has(cat.id);
        const Icon = cat.icon;
        return (
          <div key={cat.id}>
            <button
              onClick={() => toggleSection(cat.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-800/50 text-slate-300"
            >
              <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="flex-1 text-left">{cat.label}</span>
              <span className="text-xs text-slate-600 mr-1">{cat.files.length}</span>
              <ChevronDownIcon
                className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                  isExpanded ? "" : "-rotate-90"
                }`}
              />
            </button>
            {isExpanded && (
              <div className="grid grid-cols-2 gap-2 px-1 pt-1 pb-2">
                {cat.files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => selectFile(file)}
                    className={`group relative rounded-lg overflow-hidden transition-all text-left ${
                      isActiveFile(file)
                        ? "ring-2 ring-violet-500 ring-offset-1 ring-offset-[#0a0a0f]"
                        : "hover:ring-1 hover:ring-slate-600"
                    }`}
                  >
                    {file.image && seriesId ? (
                      <div className="aspect-[2/3] bg-slate-800 relative">
                        <Image
                          src={`${API_BASE}/${seriesId}/${file.image}`}
                          alt={file.label}
                          fill
                          className="object-cover"
                          sizes="150px"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <span className="absolute bottom-0 left-0 right-0 px-2 py-1.5 text-[11px] font-medium text-white leading-tight">
                          {file.label}
                        </span>
                      </div>
                    ) : (
                      <div className="aspect-[2/3] bg-slate-800/60 flex flex-col items-center justify-center gap-1 p-2 relative">
                        <DocumentTextIcon className="w-5 h-5 text-slate-600" />
                        <span className="text-[11px] font-medium text-slate-400 text-center leading-tight">
                          {file.label}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderGroupedSidebar = (
    groups: { label: string; id: string; files: FileItem[] }[]
  ) => (
    <div className="space-y-1">
      {groups.map((group) => {
        const isExpanded = expandedSections.has(group.id);
        return (
          <div key={group.id}>
            <button
              onClick={() => toggleSection(group.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-800/50 text-slate-300"
            >
              <FolderIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="flex-1 text-left">{group.label}</span>
              <span className="text-xs text-slate-600 mr-1">{group.files.length}</span>
              <ChevronDownIcon
                className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                  isExpanded ? "" : "-rotate-90"
                }`}
              />
            </button>
            {isExpanded && (
              <div className="space-y-0.5 pl-3 pb-1">
                {group.files.map((file) => (
                  <div key={file.id} className="flex items-center gap-1">
                    <button
                      onClick={() => selectFile(file)}
                      className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors text-left ${
                        isActiveFile(file)
                          ? "bg-violet-500/20 text-violet-300"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                      }`}
                    >
                      <DocumentTextIcon className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                      <span className="truncate">{file.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderChaptersSidebar = () => {
    const getMediaIcon = (filename: string) => {
      if (filename.endsWith(".mp4")) return VideoCameraIcon;
      if (filename.endsWith(".jpg") || filename.endsWith(".png")) return PhotoIcon;
      if (filename.startsWith("background-music")) return MusicalNoteIcon;
      if (filename.startsWith("sfx-")) return SpeakerWaveIcon;
      return MusicalNoteIcon; // tts and other audio
    };

    const getMediaGroup = (filename: string) => {
      if (filename.endsWith(".mp4")) return "Videos";
      if (filename.endsWith(".jpg") || filename.endsWith(".png")) return "Images";
      if (filename.startsWith("background-music")) return "Music";
      if (filename.startsWith("sfx-")) return "Sound Effects";
      if (filename.startsWith("tts-")) return "Voice Lines";
      return "Other";
    };

    const groupOrder = ["Images", "Videos", "Music", "Sound Effects", "Voice Lines", "Other"];

    return (
      <div className="space-y-1">
        {chapters.map((ch) => {
          const chId = `ch-${ch.chapterNum}`;
          const isExpanded = expandedSections.has(chId);

          // Group media files by type
          const mediaGroups: Record<string, FileItem[]> = {};
          for (const m of ch.media) {
            const group = getMediaGroup(m.label);
            if (!mediaGroups[group]) mediaGroups[group] = [];
            mediaGroups[group].push(m);
          }
          const sortedMediaGroups = Object.entries(mediaGroups).sort(
            ([a], [b]) => (groupOrder.indexOf(a) === -1 ? 99 : groupOrder.indexOf(a)) - (groupOrder.indexOf(b) === -1 ? 99 : groupOrder.indexOf(b))
          );

          return (
            <div key={chId}>
              <button
                onClick={() => toggleSection(chId)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-800/50 text-slate-300"
              >
                <FolderIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="flex-1 text-left">Chapter {ch.chapterNum}</span>
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                    isExpanded ? "" : "-rotate-90"
                  }`}
                />
              </button>
              {isExpanded && (
                <div className="pl-3 pb-2 space-y-2">
                  {/* Documents */}
                  {ch.files.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Documents</div>
                      <div className="space-y-0.5">
                        {ch.files.map((file) => (
                          <div key={file.id} className="flex items-center gap-1">
                            <button
                              onClick={() => selectFile(file)}
                              className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors text-left ${
                                isActiveFile(file)
                                  ? "bg-violet-500/20 text-violet-300"
                                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                              }`}
                            >
                              <DocumentTextIcon className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                              <span className="truncate">{file.label}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pages */}
                  {ch.pages.length > 0 && (() => {
                    const pagesId = `${chId}-pages`;
                    const pagesOpen = expandedSections.has(pagesId);
                    return (
                      <div>
                        <button
                          onClick={() => toggleSection(pagesId)}
                          className="w-full flex items-center gap-2 px-2 py-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-400 transition-colors"
                        >
                          <PhotoIcon className="w-3 h-3" />
                          <span>Pages ({ch.pages.length})</span>
                          <ChevronDownIcon className={`w-2.5 h-2.5 ml-auto transition-transform ${pagesOpen ? "" : "-rotate-90"}`} />
                        </button>
                        {pagesOpen && (
                          <div className="space-y-1 px-1 pt-1">
                            {ch.pages.map((pg) => {
                              const pageId = `${chId}-page-${pg.num}`;
                              const pageExpanded = expandedSections.has(pageId);
                              const isActive = activeFilePath === pg.image;
                              const basePath = `chapters/${ch.chapterNum}/pages/${pg.num}`;
                              return (
                                <div key={pg.num}>
                                  <div className="flex items-center gap-1">
                                    {pg.panelFiles.length > 0 && (
                                      <button
                                        onClick={() => toggleSection(pageId)}
                                        className="p-0.5 text-slate-600 hover:text-slate-400 transition-colors"
                                      >
                                        <ChevronDownIcon className={`w-2.5 h-2.5 transition-transform ${pageExpanded ? "" : "-rotate-90"}`} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setActiveFilePath(pg.image);
                                        setActiveFileImage(null);
                                        setContent("");
                                        setSidebarOpen(false);
                                      }}
                                      className={`flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all ${
                                        isActive
                                          ? "bg-violet-500/15 text-violet-300"
                                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                                      }`}
                                    >
                                      <img
                                        src={seriesId ? `${API_BASE}/${seriesId}/${pg.image}` : ""}
                                        alt={`Page ${pg.num}`}
                                        className="w-8 h-10 object-cover rounded-sm border border-slate-700/50 flex-shrink-0"
                                        loading="lazy"
                                      />
                                      <div className="min-w-0">
                                        <div className="text-xs font-medium">Page {pg.num}</div>
                                        {pg.panelFiles.length > 0 && (
                                          <div className="text-[10px] text-slate-600">{pg.panelFiles.length} panels</div>
                                        )}
                                      </div>
                                    </button>
                                  </div>
                                  {pageExpanded && pg.panelFiles.length > 0 && (
                                    <div className="grid grid-cols-3 gap-1 pl-6 pt-1">
                                      {pg.panelFiles.map((f) => {
                                        const panelPath = `${basePath}/${f}`;
                                        const isPanelActive = activeFilePath === panelPath;
                                        return (
                                          <button
                                            key={f}
                                            onClick={() => {
                                              setActiveFilePath(panelPath);
                                              setActiveFileImage(null);
                                              setContent("");
                                              setSidebarOpen(false);
                                            }}
                                            className={`relative aspect-square rounded overflow-hidden border transition-all ${
                                              isPanelActive
                                                ? "border-violet-500 ring-1 ring-violet-500/50"
                                                : "border-slate-700/50 hover:border-slate-500"
                                            }`}
                                            title={f}
                                          >
                                            <img
                                              src={seriesId ? `${API_BASE}/${seriesId}/${panelPath}` : ""}
                                              alt={f}
                                              className="w-full h-full object-cover"
                                              loading="lazy"
                                            />
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Media */}
                  {ch.media.length > 0 && (() => {
                    const mediaId = `${chId}-media`;
                    const mediaOpen = expandedSections.has(mediaId);
                    return (
                      <div>
                        <button
                          onClick={() => toggleSection(mediaId)}
                          className="w-full flex items-center gap-2 px-2 py-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider hover:text-slate-400 transition-colors"
                        >
                          <FolderIcon className="w-3 h-3" />
                          <span>Media ({ch.media.length})</span>
                          <ChevronDownIcon className={`w-2.5 h-2.5 ml-auto transition-transform ${mediaOpen ? "" : "-rotate-90"}`} />
                        </button>
                        {mediaOpen && (
                          <div className="space-y-2 pt-1">
                            {sortedMediaGroups.map(([groupName, items]) => {
                              const groupId = `${mediaId}-${groupName}`;
                              const groupOpen = expandedSections.has(groupId);
                              const isImageGroup = groupName === "Images";
                              const GroupIcon = isImageGroup ? PhotoIcon : getMediaIcon(items[0].label);
                              return (
                                <div key={groupName}>
                                  <button
                                    onClick={() => toggleSection(groupId)}
                                    className="w-full flex items-center gap-2 px-3 py-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                                  >
                                    <GroupIcon className="w-3 h-3 flex-shrink-0" />
                                    <span>{groupName}</span>
                                    <span className="text-[10px] text-slate-600 ml-auto mr-1">{items.length}</span>
                                    <ChevronDownIcon className={`w-2.5 h-2.5 transition-transform ${groupOpen ? "" : "-rotate-90"}`} />
                                  </button>
                                  {groupOpen && isImageGroup ? (
                                    <div className="grid grid-cols-3 gap-1.5 px-1 pt-1">
                                      {items.map((file) => {
                                        const isActive = activeFilePath === file.path;
                                        return (
                                          <button
                                            key={file.id}
                                            onClick={() => {
                                              setActiveFilePath(file.path);
                                              setActiveFileImage(null);
                                              setContent("");
                                              setSidebarOpen(false);
                                            }}
                                            className={`relative aspect-[2/3] rounded overflow-hidden border transition-all ${
                                              isActive
                                                ? "border-violet-500 ring-1 ring-violet-500/50"
                                                : "border-slate-700/50 hover:border-slate-500"
                                            }`}
                                          >
                                            <img
                                              src={seriesId ? `${API_BASE}/${seriesId}/${file.path}` : ""}
                                              alt={file.label}
                                              className="w-full h-full object-cover"
                                              loading="lazy"
                                            />
                                            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-slate-300 text-center py-0.5">
                                              {file.label}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : groupOpen ? (
                                    <div className="space-y-0.5 pl-2">
                                      {items.map((file) => {
                                        const Icon = getMediaIcon(file.label);
                                        return (
                                          <button
                                            key={file.id}
                                            onClick={() => {
                                              setActiveFilePath(file.path);
                                              setActiveFileImage(null);
                                              setContent("");
                                              setSidebarOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors text-left ${
                                              activeFilePath === file.path
                                                ? "bg-violet-500/20 text-violet-300"
                                                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                                            }`}
                                          >
                                            <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                                            <span className="truncate">{file.label}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderFlatSidebar = (files: FileItem[]) => (
    <div className="space-y-0.5 px-1">
      {files.map((file) => (
        <div key={file.id} className="flex items-center gap-1">
          <button
            onClick={() => selectFile(file)}
            className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
              isActiveFile(file)
                ? "bg-violet-500/20 text-violet-300"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <DocumentTextIcon className="w-4 h-4 flex-shrink-0 opacity-50" />
            <span className="truncate">{file.label}</span>
          </button>
        </div>
      ))}
    </div>
  );

  const renderSidebarContent = () => {
    switch (activeCategory) {
      case "world":
        return renderWorldSidebar();
      case "chapters":
        return renderChaptersSidebar();
      case "arcs":
        return renderGroupedSidebar(
          arcs.map((a) => ({
            id: `arc-${a.arcNum}`,
            label: `Arc ${a.arcNum}`,
            files: a.files,
          }))
        );
      case "sources":
        return renderFlatSidebar(sources);
      case "modules":
        return renderFlatSidebar(modules);
      case "meta":
        return renderFlatSidebar(meta);
      default:
        return null;
    }
  };

  // Handle category switch
  const handleCategoryChange = (id: CategoryId) => {
    setActiveCategory(id);
    setContent("");
    setActiveFilePath(null);
    setActiveFileImage(null);
    setExpandedSections(new Set());

    // Auto-select first item
    if (id === "world") {
      const first = worldCategories.find((c) => c.files.length > 0);
      if (first) {
        setExpandedSections(new Set([first.id]));
        if (first.files[0]) selectFile(first.files[0]);
      }
    } else if (id === "chapters" && chapters.length > 0) {
      setExpandedSections(new Set([`ch-${chapters[0].chapterNum}`]));
      if (chapters[0].files[0]) selectFile(chapters[0].files[0]);
    } else if (id === "arcs" && arcs.length > 0) {
      setExpandedSections(new Set([`arc-${arcs[0].arcNum}`]));
      if (arcs[0].files[0]) selectFile(arcs[0].files[0]);
    } else if (id === "sources" && sources.length > 0) {
      selectFile(sources[0]);
    } else if (id === "modules" && modules.length > 0) {
      selectFile(modules[0]);
    } else if (id === "meta" && meta.length > 0) {
      selectFile(meta[0]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <h1 className="text-2xl text-slate-300 mb-4">Series not found</h1>
          <Link href={`/${seriesId}`} className="text-violet-400 hover:text-violet-300 transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const backgroundStyle = backgroundImage
    ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }
    : {};

  return (
    <div
      className="h-screen bg-[#0a0a0f] text-white flex flex-col relative overflow-hidden"
      style={backgroundStyle}
    >
      {backgroundImage && (
        <div className="fixed inset-0 bg-[#0a0a0f]/80 pointer-events-none z-0" />
      )}

      {/* Header */}
      <header className="flex-shrink-0 sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/5">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/${seriesId}`}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm group"
            >
              <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              {entry.title}
            </Link>
            <span className="text-slate-700">|</span>
            <span className="text-sm font-medium text-white">Sources</span>
          </div>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-slate-400 hover:text-white transition-colors lg:hidden"
          >
            {sidebarOpen ? (
              <XMarkIcon className="w-5 h-5" />
            ) : (
              <Bars3Icon className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-4 pb-2 overflow-x-auto scrollbar-hide items-center">
          {CATEGORIES.map((cat) => (
            <span key={cat.id} className="contents">
              {cat.dividerBefore && (
                <div className="w-px h-5 bg-slate-700/50 mx-1 flex-shrink-0" />
              )}
              <button
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeCategory === cat.id
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                {cat.label}
              </button>
            </span>
          ))}
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-30 bg-[#0a0a0f]/95 backdrop-blur-sm border-r border-slate-800/50 transform transition-all duration-300 overflow-hidden
            lg:relative lg:translate-x-0 lg:flex-shrink-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            ${sidebarCollapsed ? "lg:w-0 lg:border-r-0" : "w-72 lg:w-72"}
          `}
        >
          <div className={`flex flex-col h-full pt-24 lg:pt-0 overflow-y-auto p-2 w-72 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            {renderSidebarContent()}
          </div>
        </aside>

        {/* Sidebar collapse toggle (desktop) */}
        <button
          onClick={() => setSidebarCollapsed((v) => !v)}
          className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-30 items-center justify-center w-5 h-10 rounded-r-md bg-slate-800/80 border border-l-0 border-slate-700/50 text-slate-500 hover:text-white hover:bg-slate-700/80 transition-all"
          style={{ left: sidebarCollapsed ? 0 : "18rem" }}
          title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronDoubleRightIcon className="w-3 h-3" />
          ) : (
            <ChevronDoubleLeftIcon className="w-3 h-3" />
          )}
        </button>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Content */}
        <main ref={contentRef} className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto">
              {activeFilePath && activeFileType === "image" && seriesId ? (
                <div className="max-w-3xl mx-auto px-6 py-8 lg:py-10 animate-fade-in flex justify-center">
                  <img
                    src={`${API_BASE}/${seriesId}/${activeFilePath}`}
                    alt={activeFilePath.split("/").pop() || ""}
                    className="max-w-full max-h-[80vh] rounded-xl border-2 border-slate-700/50 shadow-2xl shadow-black/50"
                  />
                </div>
              ) : activeFilePath && activeFileType === "audio" && seriesId ? (
                <div className="max-w-xl mx-auto px-6 py-16 animate-fade-in flex flex-col items-center gap-4">
                  <MusicalNoteIcon className="w-16 h-16 text-slate-600" />
                  <p className="text-sm text-slate-300 font-medium">{activeFilePath.split("/").pop()}</p>
                  <audio controls className="w-full" src={`${API_BASE}/${seriesId}/${activeFilePath}`} />
                </div>
              ) : activeFilePath && activeFileType === "video" && seriesId ? (
                <div className="max-w-3xl mx-auto px-6 py-8 animate-fade-in">
                  <video
                    controls
                    className="w-full rounded-xl border-2 border-slate-700/50 shadow-2xl shadow-black/50"
                    src={`${API_BASE}/${seriesId}/${activeFilePath}`}
                  />
                  <p className="text-xs text-slate-500 text-center mt-3">{activeFilePath.split("/").pop()}</p>
                </div>
              ) : activeFilePath && content && content !== "__media__" ? (
                <div className="max-w-3xl mx-auto px-6 py-8 lg:py-10 animate-fade-in">
                  {activeFileImage && (
                    <div className="flex justify-center mb-8">
                      <div className="relative">
                        <Image
                          src={activeFileImage}
                          alt=""
                          width={320}
                          height={427}
                          className="w-64 sm:w-72 md:w-80 h-auto rounded-xl border-2 border-slate-700/50 shadow-2xl shadow-black/50"
                        />
                        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
                      </div>
                    </div>
                  )}
                  <MarkdownContent content={content} variant="extras" />
                </div>
              ) : activeFilePath && !content ? (
                <div className="flex-1 flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Loading...</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center h-full">
                  <div className="text-center py-20">
                    <BookOpenIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Select a file to view</p>
                  </div>
                </div>
              )}
            </div>
        </main>
      </div>
    </div>
  );
}

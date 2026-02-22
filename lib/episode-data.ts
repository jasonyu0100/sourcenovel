import type { EpisodeBeat, EpisodeChapterData, EpisodeData } from "./episode-types";
import { getContentManifest, getChapterDraft, extractTitleFromMarkdown, getMusicPath } from "./series";
import { API_BASE } from "./constants";

interface RawDialogue {
  speaker: string;
  voice_id: string;
  text: string;
}

interface RawPanel {
  name: string;
  prompt: string;
  ref?: string[];
  dialogue?: RawDialogue[];
  silence?: number;
  pause_after?: number;
  sfx?: { description: string; duration: number }[];
}

function resolveRefs(seriesId: string, refs: string[]): { backdrop: string | null; characters: string[] } {
  const backdrop = refs
    .filter(r => r.startsWith("world/locations/"))
    .map(r => `${API_BASE}/${seriesId}/${r}`)
    .pop() || null;

  const characters = refs
    .filter(r => r.startsWith("world/characters/"))
    .map(r => `${API_BASE}/${seriesId}/${r}`);

  return { backdrop, characters };
}

function parsePanelsToBeats(
  seriesId: string,
  chapterNum: number,
  pageNum: number,
  panels: RawPanel[],
  ttsCounter: { value: number },
  sfxCounter: { value: number }
): EpisodeBeat[] {
  const beats: EpisodeBeat[] = [];

  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    const { backdrop, characters } = resolveRefs(seriesId, panel.ref || []);

    const hasDialogue = panel.dialogue && panel.dialogue.length > 0;
    const panelImageSrc = `${API_BASE}/${seriesId}/chapters/${chapterNum}/pages/${pageNum}/${i + 1}-${panel.name}.jpg`;

    const sfxSrcs: string[] = [];
    if (panel.sfx && panel.sfx.length > 0) {
      for (let s = 0; s < panel.sfx.length; s++) {
        sfxCounter.value++;
        sfxSrcs.push(`${API_BASE}/${seriesId}/chapters/${chapterNum}/media/sfx-${sfxCounter.value}.mp3`);
      }
    }

    if (hasDialogue) {
      // Create one beat per dialogue line to stay in sync with TTS indices
      for (let d = 0; d < panel.dialogue!.length; d++) {
        const dlg = panel.dialogue![d];
        ttsCounter.value++;
        const isLastLine = d === panel.dialogue!.length - 1;
        beats.push({
          id: `${chapterNum}-${pageNum}-${panel.name}-${d}`,
          chapterNum,
          pageNum,
          panelIndex: i,
          panelImageSrc,
          backdropSrc: backdrop,
          characterSrcs: characters,
          dialogue: {
            speaker: dlg.speaker,
            text: dlg.text,
            ttsSrc: `${API_BASE}/${seriesId}/chapters/${chapterNum}/media/tts-${ttsCounter.value}.mp3`,
          },
          sfxSrcs: d === 0 ? sfxSrcs : [],
          silenceDuration: null,
          pauseAfter: isLastLine ? (panel.pause_after ?? 0) : 0,
        });
      }
    } else {
      // Silent panel — single beat
      beats.push({
        id: `${chapterNum}-${pageNum}-${panel.name}`,
        chapterNum,
        pageNum,
        panelIndex: i,
        panelImageSrc,
        backdropSrc: backdrop,
        characterSrcs: characters,
        dialogue: null,
        sfxSrcs,
        silenceDuration: panel.silence ?? null,
        pauseAfter: panel.pause_after ?? 0,
      });
    }
  }

  return beats;
}

export async function loadEpisodeChapterData(
  seriesId: string,
  chapterNum: number
): Promise<EpisodeChapterData | null> {
  const manifest = await getContentManifest(seriesId);
  if (!manifest) return null;

  const chapter = manifest.chapters.find(c => c.number === chapterNum);
  if (!chapter) return null;

  const draft = await getChapterDraft(seriesId, chapterNum);
  const title = extractTitleFromMarkdown(draft) || `Chapter ${chapterNum}`;

  const ttsCounter = { value: 0 };
  const sfxCounter = { value: 0 };
  const allBeats: EpisodeBeat[] = [];

  for (const p of chapter.pages) {
    const pageNum = typeof p === "object" ? p.number : p;
    try {
      const res = await fetch(`${API_BASE}/${seriesId}/chapters/${chapterNum}/pages/${pageNum}/panels.json`);
      if (!res.ok) continue;
      const panels: RawPanel[] = await res.json();
      const beats = parsePanelsToBeats(seriesId, chapterNum, pageNum, panels, ttsCounter, sfxCounter);
      allBeats.push(...beats);
    } catch {
      continue;
    }
  }

  const musicSrc = getMusicPath(seriesId, chapterNum);

  return {
    chapterNum,
    title,
    beats: allBeats,
    musicSrc,
  };
}

export async function loadAllEpisodeChapterSummaries(
  seriesId: string
): Promise<{ chapterNum: number; title: string; pageCount: number; thumbnail: string | null }[]> {
  const manifest = await getContentManifest(seriesId);
  if (!manifest) return [];

  const results = await Promise.all(
    manifest.chapters.map(async (chapter) => {
      // Only include chapters that have episode.json (episode ready)
      const episodeData = await loadEpisodeData(seriesId, chapter.number);
      if (!episodeData) return null;

      const draft = await getChapterDraft(seriesId, chapter.number);
      const title = extractTitleFromMarkdown(draft) || `Chapter ${chapter.number}`;

      const firstPage = chapter.pages[0];
      const firstPageNum = typeof firstPage === "object" ? firstPage.number : firstPage;
      const thumbnail = firstPageNum
        ? `${API_BASE}/${seriesId}/chapters/${chapter.number}/pages/${firstPageNum}/page.jpg`
        : null;

      return { chapterNum: chapter.number, title, pageCount: chapter.pages.length, thumbnail };
    })
  );

  return results
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.chapterNum - b.chapterNum);
}

export async function loadEpisodeData(
  seriesId: string,
  chapterNum: number
): Promise<EpisodeData | null> {
  try {
    const res = await fetch(`${API_BASE}/${seriesId}/chapters/${chapterNum}/episode.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadInteractiveModule(
  seriesId: string
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/${seriesId}/modules/interactive-module.md`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function loadChapterRoute(
  seriesId: string,
  chapterNum: number
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/${seriesId}/chapters/${chapterNum}/route.md`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function loadChapterMemory(
  seriesId: string,
  chapterNum: number
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/${seriesId}/chapters/${chapterNum}/memory.md`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function loadSeriesContext(
  seriesId: string
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/${seriesId}/series.md`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function loadArcContext(
  seriesId: string,
  arcNum: number = 1
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/${seriesId}/arcs/${arcNum}/arc.md`);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function loadCharacterProfiles(
  seriesId: string,
  slugs: string[]
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const res = await fetch(`${API_BASE}/${seriesId}/world/characters/${slug}.md`);
        if (!res.ok) return null;
        const text = await res.text();
        return [slug, text] as [string, string];
      } catch {
        return null;
      }
    })
  );
  return Object.fromEntries(entries.filter((e): e is [string, string] => e !== null));
}

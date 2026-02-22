import type { EpisodeChapterData, EpisodeData } from "./episode-types";
import { API_BASE } from "./constants";

export interface StoryContext {
  seriesId: string;
  chapterNum: number;
  chapterTitle: string;
  beatIndex: number;
  totalBeats: number;
  storyRecap: string;
  currentLocation: string | null;
  currentCharacters: string[];
  povCharacter: string;
  /** Episode data from episode.json — characters, locations for AI context */
  episodeData: EpisodeData | null;
  /** Chapter route.md — beat-by-beat narrative direction */
  chapterRoute: string | null;
  /** Chapter memory.md — historical context and continuity */
  chapterMemory: string | null;
  /** Recent beat names — semantic landmarks for position in route.md */
  recentBeatNames: string[];
  /** Last dialogue line spoken before handoff */
  lastDialogue: string | null;
  /** Series context from series.md — overarching story, themes, and direction */
  seriesContext: string | null;
  /** Arc context from arc.md — immediate story direction and chapter-level goals */
  arcContext: string | null;
  /** Character profiles from world/characters/{slug}.md keyed by slug */
  characterProfiles: Record<string, string> | null;
}

/**
 * Build a story context from the current episode state + optional episode.json data.
 */
export function buildStoryContext(
  seriesId: string,
  chapterData: EpisodeChapterData,
  beatIndex: number,
  episodeData?: EpisodeData | null,
  chapterRoute?: string | null,
  chapterMemory?: string | null,
  seriesContext?: string | null,
  arcContext?: string | null,
  characterProfiles?: Record<string, string> | null
): StoryContext {
  const beats = chapterData.beats.slice(0, beatIndex + 1);

  // Build recap from beats — dialogue + scene transitions
  const lines: string[] = [];
  let lastLocation: string | null = null;
  let lastCharacters: string[] = [];
  for (const beat of beats) {
    // Note location changes
    if (beat.backdropSrc) {
      const locMatch = beat.backdropSrc.match(/locations\/([^.]+)/);
      const loc = locMatch ? locMatch[1].replace(/-/g, " ") : null;
      if (loc && loc !== lastLocation) {
        lines.push(`[Scene: ${loc}]`);
        lastLocation = loc;
      }
    }
    // Note new characters appearing
    const chars = (beat.characterSrcs || []).map(src => {
      const m = src.match(/characters\/([^.]+)/);
      return m ? m[1].replace(/-/g, " ") : "";
    }).filter(Boolean);
    const newChars = chars.filter(c => !lastCharacters.includes(c));
    if (newChars.length > 0) {
      lines.push(`[${newChars.join(", ")} ${newChars.length === 1 ? "appears" : "appear"}]`);
    }
    lastCharacters = chars.length > 0 ? chars : lastCharacters;
    // Dialogue
    if (beat.dialogue) {
      lines.push(`${beat.dialogue.speaker}: "${beat.dialogue.text}"`);
    }
  }
  const storyRecap = lines.join("\n");

  // Find current location from the most recent beat with a backdrop
  let currentLocation: string | null = null;
  for (let i = beatIndex; i >= 0; i--) {
    if (chapterData.beats[i].backdropSrc) {
      const match = chapterData.beats[i].backdropSrc!.match(/locations\/([^.]+)/);
      currentLocation = match ? match[1].replace(/-/g, " ") : null;
      break;
    }
  }

  // Get characters visible in recent beats
  const currentBeat = chapterData.beats[beatIndex];
  const currentCharacters = (currentBeat?.characterSrcs || []).map(src => {
    const match = src.match(/characters\/([^.]+)/);
    return match ? match[1].replace(/-/g, " ") : "";
  }).filter(Boolean);

  // Default character from episode.json or fallback to first visible character
  const povCharacter = episodeData?.defaultCharacter
    || (currentCharacters.length > 0
      ? currentCharacters[0].replace(/\b\w/g, c => c.toUpperCase())
      : "Unknown");

  // Recent beat names — semantic landmarks (last 5)
  const recentBeatNames = beats.slice(-5).map(b => {
    const parts = b.id.split("-");
    return parts.slice(2).join("-"); // strip chapterNum-pageNum prefix
  });

  // Last dialogue spoken
  let lastDialogue: string | null = null;
  for (let i = beats.length - 1; i >= 0; i--) {
    if (beats[i].dialogue) {
      lastDialogue = `${beats[i].dialogue!.speaker}: "${beats[i].dialogue!.text}"`;
      break;
    }
  }

  return {
    seriesId,
    chapterNum: chapterData.chapterNum,
    chapterTitle: chapterData.title,
    beatIndex,
    totalBeats: chapterData.beats.length,
    storyRecap,
    currentLocation,
    currentCharacters,
    povCharacter,
    episodeData: episodeData || null,
    chapterRoute: chapterRoute || null,
    chapterMemory: chapterMemory || null,
    recentBeatNames,
    lastDialogue,
    seriesContext: seriesContext || null,
    arcContext: arcContext || null,
    characterProfiles: characterProfiles || null,
  };
}

/**
 * Resolve a location name to its image path using episode.json data or slug fallback.
 */
export function locationToImageSrc(seriesId: string, locationName: string, episodeData?: EpisodeData | null): string | null {
  const slug = locationName.toLowerCase().replace(/\s+/g, "-");

  // Check episode.json locations first, fallback to slug
  if (episodeData) {
    const loc = episodeData.locations.find(l => l.slug === slug);
    if (loc) return `${API_BASE}/${seriesId}/world/locations/${loc.slug}.jpg`;
  }

  return `${API_BASE}/${seriesId}/world/locations/${slug}.jpg`;
}

/**
 * Resolve a character name to their portrait image path using episode.json data.
 * Returns null for unknown characters — UI should show a fallback avatar.
 */
export function characterToImageSrc(seriesId: string, characterName: string, episodeData?: EpisodeData | null): string | null {
  if (!episodeData) return null;

  const nameLower = characterName.toLowerCase();
  const slug = nameLower.replace(/\s+/g, "-");

  // Match by slug, full name, or first name (panels.json often uses first names only)
  const char = episodeData.characters.find(c =>
    c.slug === slug ||
    c.name.toLowerCase() === nameLower ||
    c.name.toLowerCase().split(" ")[0] === nameLower
  );

  return char ? `${API_BASE}/${seriesId}/world/characters/${char.slug}.jpg` : null;
}

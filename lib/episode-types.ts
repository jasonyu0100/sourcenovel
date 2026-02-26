export interface EpisodeDialogue {
  speaker: string;
  text: string;
  ttsSrc: string | null;
}

export interface EpisodeBeat {
  id: string;
  chapterNum: number;
  pageNum: number;
  panelIndex: number;
  panelImageSrc: string;
  backdropSrc: string | null;
  characterSrcs: string[];
  dialogue: EpisodeDialogue | null;
  sfxSrcs: string[];
  silenceDuration: number | null;
  pauseAfter: number;
}

export interface EpisodeChapterData {
  chapterNum: number;
  title: string;
  beats: EpisodeBeat[];
  musicSrc: string | null;
}

export interface EpisodeCharacter {
  name: string;
  slug: string;
}

export interface EpisodeLocation {
  name: string;
  slug: string;
}

export interface EpisodeData {
  chapterNum: number;
  arcNum?: number;
  defaultCharacter: string;
  startingLocation?: string;
  characters: EpisodeCharacter[];
  locations: EpisodeLocation[];
}

export interface PanelRequest {
  seriesId: string;
  narration: string;
  speaker: string | null;
  dialogue: string | null;
  location: string | null;
  povCharacter: string;
  characterSlugs: string[];
  previousPanelUrl: string | null;
}

export interface PanelSubmitResponse {
  predictionId: string;
}

export interface PanelStatusResponse {
  status: "starting" | "processing" | "succeeded" | "failed";
  panelUrl: string | null;
}

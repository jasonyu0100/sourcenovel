export interface Author {
  name: string;
  email?: string;
}

export interface SeriesEntry {
  id: string;
  title: string;
  genre: string;
  description: string; // One-line series hook for intro screen and series home
  author?: Author;
  chapters?: number[]; // Auto-discovered from file system if not provided
  cover?: string;
  background?: string; // Full-width background for series home hero
  donationLink?: string;
}

export interface PageImage {
  src: string;
  chapterNum: number;
  pageNum: number;
}

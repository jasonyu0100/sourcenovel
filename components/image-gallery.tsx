"use client";

import type { PageImage } from "@/lib/types";

interface MangaPagesProps {
  pages: PageImage[];
}

export function MangaPages({ pages }: MangaPagesProps) {
  if (pages.length === 0) return null;

  return (
    <div className="space-y-4 mx-auto max-w-lg">
      {pages.map((page) => (
        <div
          key={`${page.chapterNum}-${page.pageNum}`}
          className="relative overflow-hidden rounded-lg bg-slate-800 aspect-[7/10]"
        >
          <img
            src={page.src}
            alt={`Page ${page.pageNum}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import type { PageImage } from "@/lib/types";

interface ImageFeedProps {
  images: PageImage[];
  columns?: number;
  collapsedRows?: number;
  onImageClick?: (image: PageImage) => void;
}

export function ImageFeed({ images, columns = 3, collapsedRows = 2, onImageClick }: ImageFeedProps) {
  const [expanded, setExpanded] = useState(false);

  if (images.length === 0) return null;

  // Calculate how many images to show when collapsed
  const collapsedCount = columns * collapsedRows;
  const displayedImages = expanded ? images : images.slice(0, collapsedCount);
  const hiddenCount = images.length - collapsedCount;
  const showExpandButton = images.length > collapsedCount;

  return (
    <>
      {/* Grid of page composites */}
      <div className="relative">
        <div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3"
        >
          {displayedImages.map((image) => (
            <div
              key={`${image.chapterNum}-${image.pageNum}`}
              className={`relative overflow-hidden bg-slate-800 group rounded aspect-[7/10]${onImageClick ? " cursor-pointer" : ""}`}
              onClick={onImageClick ? () => onImageClick(image) : undefined}
            >
              <img
                src={image.src}
                alt={`Chapter ${image.chapterNum} - Page ${image.pageNum}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                loading="lazy"
              />
              {/* Hover overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-medium">
                  Ch. {image.chapterNum} &middot; Page {image.pageNum}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Gradient fade when collapsed */}
        {!expanded && showExpandButton && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0a0f] to-transparent pointer-events-none" />
        )}
      </div>

      {/* Expand/Collapse button */}
      {showExpandButton && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 py-2.5 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-violet-400 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800/50 hover:border-violet-500/30 rounded-lg transition-all"
        >
          {expanded ? (
            <>
              <ChevronUpIcon className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDownIcon className="w-4 h-4" />
              Show all {images.length} pages (+{hiddenCount} more)
            </>
          )}
        </button>
      )}
    </>
  );
}

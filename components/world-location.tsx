"use client";

import { useState } from "react";
import { ChevronRightIcon, MapIcon } from "@heroicons/react/24/outline";
import type { WorldMapLocation } from "@/lib/world-types";

interface WorldLocationProps {
  seriesId: string;
  location: WorldMapLocation;
  connectedLocations: WorldMapLocation[];
  onBack: () => void;
  onNavigate: (slug: string) => void;
}

export function WorldLocation({
  seriesId,
  location,
  connectedLocations,
  onBack,
  onNavigate,
}: WorldLocationProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Backdrop fallback gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/60 via-[#0a0a0f] to-slate-900/40" />

      {/* Backdrop image */}
      <img
        src={`/series/${seriesId}/world/locations/${location.image}`}
        alt={location.name}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
          imageLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setImageLoaded(true)}
      />

      {/* Bottom gradient for text readability */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 sm:p-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-slate-300 hover:text-white text-sm transition-all hover:bg-black/60"
        >
          <MapIcon className="w-4 h-4" />
          <span className="hidden sm:inline">World Map</span>
        </button>
      </div>

      {/* Connected locations nav */}
      {connectedLocations.length > 0 && (
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 flex flex-col gap-2 max-w-[260px]">
          {connectedLocations.map((conn) => {
            const connectionData = location.connections.find((c) => c.target === conn.slug);
            return (
              <button
                key={conn.slug}
                onClick={() => onNavigate(conn.slug)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 text-slate-400 hover:text-white text-xs transition-all hover:bg-black/60 hover:border-violet-500/30 text-left"
              >
                <div className="flex-1 min-w-0">
                  <span className="block font-medium text-slate-300">{conn.name}</span>
                  {connectionData?.label && (
                    <span className="block text-[10px] text-slate-500 mt-0.5 truncate">
                      {connectionData.label}
                    </span>
                  )}
                </div>
                <ChevronRightIcon className="w-3 h-3 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom content area */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-6 sm:p-10">
        <div className="animate-fade-in" style={{ animationDelay: "0.4s", animationFillMode: "both" }}>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
            {location.name}
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl">
            {location.description}
          </p>
        </div>
      </div>
    </div>
  );
}

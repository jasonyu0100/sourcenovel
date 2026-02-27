"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import type { WorldMapData } from "@/lib/world-types";
import { loadWorldMap } from "@/lib/world-data";
import { WorldMap } from "@/components/world-map";
import { WorldLocation } from "@/components/world-location";

type ViewState =
  | { mode: "map" }
  | { mode: "location"; slug: string };

export default function WorldPage() {
  const params = useParams();
  const seriesId = params.series as string;

  const [worldMap, setWorldMap] = useState<WorldMapData | null>(null);
  const [view, setView] = useState<ViewState>({ mode: "map" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const map = await loadWorldMap(seriesId);
      if (map) setWorldMap(map);
      setLoading(false);
    }
    load();
  }, [seriesId]);

  const handleSelectLocation = useCallback((slug: string) => {
    setView({ mode: "location", slug });
  }, []);

  const handleNavigate = useCallback((slug: string) => {
    setView({ mode: "location", slug });
  }, []);

  const handleBackToMap = useCallback(() => {
    setView({ mode: "map" });
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!worldMap) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">No world map available for this series.</p>
          <Link href={`/${seriesId}`} className="text-violet-400 hover:text-violet-300 text-sm">
            ← Back to series
          </Link>
        </div>
      </div>
    );
  }

  const currentLocation =
    view.mode === "location"
      ? worldMap.locations.find((l) => l.slug === view.slug)
      : null;

  const connectedLocations = currentLocation
    ? worldMap.locations.filter((l) =>
        currentLocation.connections.some((c) => c.target === l.slug)
      )
    : [];

  return (
    <div className="fixed inset-0 bg-[#0a0a0f]">
      {/* Back to series */}
      {view.mode === "map" && (
        <Link
          href={`/${seriesId}`}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-slate-300 hover:text-white text-sm transition-all hover:bg-black/60"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Series</span>
        </Link>
      )}

      {/* Map view */}
      {view.mode === "map" && (
        <WorldMap
          seriesId={seriesId}
          clusters={worldMap.clusters || []}
          locations={worldMap.locations}
          onSelectLocation={handleSelectLocation}
        />
      )}

      {/* Location view */}
      {view.mode === "location" && currentLocation && (
        <WorldLocation
          seriesId={seriesId}
          location={currentLocation}
          connectedLocations={connectedLocations}
          onBack={handleBackToMap}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}

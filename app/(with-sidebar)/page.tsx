"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpenIcon, PlayIcon } from "@heroicons/react/24/outline";
import type { SeriesEntry } from "@/lib/types";
import { getSeriesList } from "@/lib/series";
import { API_BASE } from "@/lib/constants";

export default function HomePage() {
  const [seriesList, setSeriesList] = useState<SeriesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getSeriesList()
      .then((list) => {
        setSeriesList(list);
        if (list.length === 1) {
          router.replace(`/${list[0].id}`);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (seriesList.length === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (seriesList.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center py-20 animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-center">
            <BookOpenIcon className="w-10 h-10 text-slate-600" />
          </div>
          <h2 className="text-xl text-slate-300 mb-3">No stories yet</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
            Add a series by creating a folder in <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">series/</code> and running{" "}
            <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">npm run sync</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-white mb-1">Stories</h1>
        <p className="text-slate-500 text-sm">{seriesList.length} {seriesList.length === 1 ? "world" : "worlds"} to explore</p>
      </div>

      {/* Series Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {seriesList.map((series) => (
          <Link
            key={series.id}
            href={`/${series.id}`}
            className="group flex flex-col"
          >
            {/* Cover */}
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-slate-800/50 group-hover:border-violet-500/30 transition-all duration-300 mb-3">
              {series.cover ? (
                <img
                  src={`${API_BASE}/${series.id}/${series.cover}`}
                  alt={series.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900" />
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-violet-600/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
                  <PlayIcon className="w-5 h-5 text-white" />
                </div>
              </div>

              {/* Active glow */}
              <div className="absolute inset-0 rounded-xl border-2 border-violet-500/0 group-hover:border-violet-500/30 pointer-events-none transition-colors duration-300" />
            </div>

            {/* Info */}
            <p className="text-violet-400 text-[10px] font-medium tracking-widest uppercase mb-1">
              {series.genre}
            </p>
            <h2 className="text-sm font-bold text-white group-hover:text-violet-200 transition-colors leading-snug">
              {series.title}
            </h2>
          </Link>
        ))}
      </div>
    </div>
  );
}

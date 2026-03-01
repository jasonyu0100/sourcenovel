"use client";

import type { ArcInfo } from "@/lib/world-data";

interface ArcSelectionModalProps {
  arcs: ArcInfo[];
  onSelect: (arcNum: number) => void;
  onCancel: () => void;
}

export function ArcSelectionModal({ arcs, onSelect, onCancel }: ArcSelectionModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-[#0f0f18] border border-violet-500/20 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/10">
          <span className="text-[10px] uppercase tracking-widest text-violet-400">Choose Arc</span>
          <h2 className="text-base font-semibold text-white mt-0.5">Select a Story Arc</h2>
          <p className="text-xs text-slate-500 mt-1">Each arc defines the characters, tensions, and narrative direction for the simulation.</p>
        </div>

        <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
          {arcs.map((arc) => (
            <button
              key={arc.arcNum}
              onClick={() => onSelect(arc.arcNum)}
              className="w-full text-left px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-violet-500/10 hover:border-violet-500/20 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-medium text-violet-400/60 bg-violet-500/10 px-1.5 py-0.5 rounded">
                  Arc {arc.arcNum}
                </span>
                <span className="text-sm font-medium text-white group-hover:text-violet-200 transition-colors">
                  {arc.name}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {arc.description}
              </p>
            </button>
          ))}

          {arcs.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-8">No arcs with scenarios found.</p>
          )}
        </div>

        <div className="px-6 py-3 border-t border-white/[0.05] flex justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-xs rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

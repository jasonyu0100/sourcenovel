"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useWorldMarkdown } from "@/lib/use-world-description";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function CharacterPreviewTooltip({
  character,
  imageSrc,
  children,
  position = "bottom"
}: {
  character: { name: string } | null;
  imageSrc: string | null;
  children: React.ReactNode;
  position?: "top" | "bottom";
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const description = useWorldMarkdown(imageSrc);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setShowPreview(true), 200);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowPreview(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPreview(false);
    setShowFullscreen(true);
  };

  const closeFullscreen = () => {
    setShowFullscreen(false);
  };

  useEffect(() => {
    if (showFullscreen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") closeFullscreen();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showFullscreen]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!character || !imageSrc) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}
        {showPreview && !showFullscreen && (
          <div
            className={`absolute z-50 w-72 rounded-xl bg-slate-900/95 border border-white/10 backdrop-blur-md shadow-2xl overflow-hidden ${
              position === "bottom"
                ? "top-full mt-2 left-1/2 -translate-x-1/2"
                : "bottom-full mb-2 left-1/2 -translate-x-1/2"
            }`}
            style={{ animation: "fadeIn 0.15s ease-out" }}
          >
            <img
              src={imageSrc}
              alt={character.name}
              className="w-full max-h-80 object-contain bg-black/50"
            />
            <div className="p-3 max-h-48 overflow-y-auto">
              <h4 className="text-white font-semibold text-sm">{character.name}</h4>
              {description && (
                <div className="mt-1">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="text-white/50 text-xs leading-relaxed mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="text-white/70 font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="text-white/40 italic">{children}</em>,
                      code: ({ children }) => <code className="text-violet-300/60 text-[10px] font-mono bg-white/5 px-1 py-0.5 rounded">{children}</code>,
                      pre: ({ children }) => <pre className="text-[10px] bg-white/5 rounded p-2 overflow-x-auto mt-1 mb-2">{children}</pre>,
                    }}
                  >
                    {description}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            {/* Arrow */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900/95 border-white/10 rotate-45 ${
                position === "bottom"
                  ? "-top-1.5 border-l border-t"
                  : "-bottom-1.5 border-r border-b"
              }`}
            />
          </div>
        )}
      </div>

      {/* Fullscreen overlay */}
      {showFullscreen && createPortal(
        <div
          className="fixed inset-0 z-[10000] bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={closeFullscreen}
          style={{ animation: "fadeIn 0.2s ease-out" }}
        >
          <button
            onClick={closeFullscreen}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <img
            src={imageSrc}
            alt={character.name}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="mt-4 max-w-lg max-h-[25vh] overflow-y-auto text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white text-xl font-semibold">{character.name}</h3>
            {description && (
              <div className="mt-2 text-left">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="text-white/60 text-sm leading-relaxed mb-3 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="text-white/80 font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="text-white/50 italic">{children}</em>,
                    code: ({ children }) => <code className="text-violet-300/70 text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded">{children}</code>,
                    pre: ({ children }) => <pre className="text-xs bg-white/5 rounded-lg p-3 overflow-x-auto mt-2 mb-3">{children}</pre>,
                  }}
                >
                  {description}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

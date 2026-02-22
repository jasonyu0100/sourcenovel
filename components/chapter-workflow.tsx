"use client";

import { useState } from "react";
import { ChevronDownIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { WORKFLOW_FILES } from "@/lib/series";
import { MarkdownContent } from "./markdown-content";

interface ChapterWorkflowProps {
  files: Record<string, string>;
  themeColors: {
    text: string;
    textMuted: string;
    textPrimary: string;
    accent: string;
    border: string;
    background: string;
  };
}

export function ChapterWorkflow({ files, themeColors }: ChapterWorkflowProps) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const availableFiles = WORKFLOW_FILES.filter((f) => files[f.name]);

  if (availableFiles.length === 0) return null;

  return (
    <section className="mt-16">
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-8 h-8 rounded-lg border flex items-center justify-center"
          style={{
            borderColor: `${themeColors.text}20`,
            backgroundColor: `${themeColors.text}05`,
          }}
        >
          <DocumentTextIcon
            className="w-4 h-4"
            style={{ color: themeColors.textMuted }}
          />
        </div>
        <div>
          <h2
            className="font-semibold"
            style={{ color: themeColors.textPrimary }}
          >
            Chapter Workflow
          </h2>
          <p className="text-xs" style={{ color: themeColors.textMuted }}>
            {availableFiles.length} source file
            {availableFiles.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {availableFiles.map((file, index) => {
          const isExpanded = expandedFile === file.name;
          const content = files[file.name];

          return (
            <div
              key={file.name}
              className="rounded-lg border overflow-hidden transition-all"
              style={{
                borderColor: `${themeColors.text}15`,
                backgroundColor: `${themeColors.text}03`,
              }}
            >
              <button
                onClick={() =>
                  setExpandedFile(isExpanded ? null : file.name)
                }
                className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors hover:bg-black/5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium"
                    style={{
                      backgroundColor: `${themeColors.accent}20`,
                      color: themeColors.accent,
                    }}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <span
                      className="font-medium text-sm"
                      style={{ color: themeColors.textPrimary }}
                    >
                      {file.label}
                    </span>
                    <span
                      className="text-xs ml-2"
                      style={{ color: themeColors.textMuted }}
                    >
                      {file.description}
                    </span>
                  </div>
                </div>
                <ChevronDownIcon
                  className={`w-4 h-4 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                  style={{ color: themeColors.textMuted }}
                />
              </button>

              {isExpanded && content && (
                <div
                  className="px-4 pb-4 pt-2 border-t"
                  style={{ borderColor: `${themeColors.text}10` }}
                >
                  <div
                    className="prose-sm max-h-96 overflow-y-auto rounded-lg p-4"
                    style={{
                      backgroundColor: `${themeColors.text}05`,
                      color: themeColors.text,
                    }}
                  >
                    <MarkdownContent content={content} variant="extras" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

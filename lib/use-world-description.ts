"use client";

import { useState, useEffect } from "react";

const descriptionCache = new Map<string, string>();
const fullContentCache = new Map<string, string>();

/**
 * Fetch and parse the first paragraph from a world .md file.
 * Derives the .md URL from the resolved image path (swaps extension).
 */
export function useWorldDescription(imageSrc: string | null | undefined): string {
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    if (!imageSrc) return;

    const mdUrl = imageSrc.replace(/\.\w+$/, ".md");

    if (descriptionCache.has(mdUrl)) {
      setDescription(descriptionCache.get(mdUrl)!);
      return;
    }

    fetch(mdUrl)
      .then(res => res.ok ? res.text() : "")
      .then(text => {
        const lines = text.split("\n");
        let foundHeading = false;
        const para: string[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!foundHeading) {
            if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) foundHeading = true;
            continue;
          }
          if (!para.length && !trimmed) continue;
          if (para.length && (!trimmed || trimmed.startsWith("#"))) break;
          if (trimmed.startsWith(">") || trimmed.startsWith("```")) break;
          para.push(trimmed);
        }
        const desc = para.join(" ");
        descriptionCache.set(mdUrl, desc);
        setDescription(desc);
      })
      .catch(() => {});
  }, [imageSrc]);

  return description;
}

/**
 * Fetch full markdown content from a world .md file (strips leading # heading).
 * Derives the .md URL from the resolved image path (swaps extension).
 */
export function useWorldMarkdown(imageSrc: string | null | undefined): string {
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    if (!imageSrc) return;

    const mdUrl = imageSrc.replace(/\.\w+$/, ".md");

    if (fullContentCache.has(mdUrl)) {
      setContent(fullContentCache.get(mdUrl)!);
      return;
    }

    fetch(mdUrl)
      .then(res => res.ok ? res.text() : "")
      .then(text => {
        // Strip leading `# Name` heading (shown separately in UI)
        const body = text.replace(/^#\s+[^\n]+\n*/, "").trim();
        fullContentCache.set(mdUrl, body);
        setContent(body);
      })
      .catch(() => {});
  }, [imageSrc]);

  return content;
}

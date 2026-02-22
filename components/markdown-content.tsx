"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  className?: string;
  variant?: "prose" | "extras";
}

export function MarkdownContent({ content, className = "", variant = "prose" }: MarkdownContentProps) {
  const baseClass = variant === "extras" ? "prose-extras" : "prose-chapter";

  return (
    <ReactMarkdown
      className={`${baseClass} ${className}`}
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className={variant === "extras"
            ? "text-2xl font-bold text-slate-100 mb-6 tracking-tight"
            : "text-3xl font-bold mb-8 tracking-tight font-sans"
          } style={variant === "prose" ? { color: "inherit", opacity: 0.95 } : undefined}>
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className={variant === "extras"
            ? "text-xl font-semibold text-slate-200 mt-10 mb-4 tracking-tight"
            : "text-2xl font-semibold mt-16 mb-8 tracking-tight font-sans"
          } style={variant === "prose" ? { color: "inherit", opacity: 0.95 } : undefined}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className={variant === "extras"
            ? "text-lg font-medium text-slate-300 mt-6 mb-3"
            : "text-xl font-medium mt-12 mb-6 font-sans"
          } style={variant === "prose" ? { color: "inherit", opacity: 0.9 } : undefined}>
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className={variant === "extras"
            ? "mb-4 text-slate-300 leading-relaxed"
            : "mb-7 text-lg leading-[1.85] tracking-wide"
          } style={variant === "prose" ? { color: "inherit" } : undefined}>
            {children}
          </p>
        ),
        blockquote: ({ children }) => (
          <blockquote className={variant === "extras"
            ? "border-l-2 border-violet-500/40 pl-4 italic text-slate-400 my-4"
            : "border-l-2 pl-6 py-1 italic my-8 not-first-letter"
          } style={variant === "prose" ? { color: "inherit", opacity: 0.7, borderColor: "currentColor" } : undefined}>
            {children}
          </blockquote>
        ),
        ul: ({ children }) => (
          <ul className={variant === "extras"
            ? "list-disc list-inside mb-4 text-slate-300 space-y-1.5"
            : "list-disc list-inside mb-6 space-y-2"
          } style={variant === "prose" ? { color: "inherit" } : undefined}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className={variant === "extras"
            ? "list-decimal list-inside mb-4 text-slate-300 space-y-1.5"
            : "list-decimal list-inside mb-6 space-y-2"
          } style={variant === "prose" ? { color: "inherit" } : undefined}>
            {children}
          </ol>
        ),
        hr: () => (
          <hr className={variant === "extras"
            ? "my-8 border-slate-800"
            : "my-16 border-0 h-px"
          } style={variant === "prose" ? { background: "linear-gradient(to right, transparent, currentColor, transparent)", opacity: 0.15 } : undefined} />
        ),
        strong: ({ children }) => (
          <strong className={variant === "extras" ? "font-semibold text-slate-200" : "font-semibold"}
            style={variant === "prose" ? { color: "inherit" } : undefined}>{children}</strong>
        ),
        em: ({ children }) => (
          <em className={variant === "extras" ? "italic text-slate-400" : "italic"}
            style={variant === "prose" ? { color: "inherit", opacity: 0.85 } : undefined}>{children}</em>
        ),
        code: ({ children }) => (
          <code className="bg-slate-800/80 px-1.5 py-0.5 rounded text-violet-300 text-sm font-mono">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 overflow-x-auto mb-4 font-mono text-sm">
            {children}
          </pre>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
            target={href?.startsWith("http") ? "_blank" : undefined}
            rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {children}
          </a>
        ),
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt || ""}
            className="rounded-lg my-6 max-w-full"
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

"use client";

import { createContext, useContext, useEffect, useState, ReactNode, CSSProperties } from "react";

export type ReaderTheme = "dark" | "light" | "sepia";
export type ReaderFont = "serif" | "sans" | "mono";
export type ReaderWidth = "narrow" | "medium" | "wide";

export interface ReaderSettings {
  theme: ReaderTheme;
  font: ReaderFont;
  fontSize: number; // 14-24
  width: ReaderWidth;
  lineHeight: number; // 1.5-2.2
}

const defaultSettings: ReaderSettings = {
  theme: "dark",
  font: "serif",
  fontSize: 18,
  width: "medium",
  lineHeight: 1.85,
};

interface ReaderSettingsContextType {
  settings: ReaderSettings;
  updateSettings: (partial: Partial<ReaderSettings>) => void;
  resetSettings: () => void;
}

const ReaderSettingsContext = createContext<ReaderSettingsContextType | null>(null);

const STORAGE_KEY = "reader-settings";

export function ReaderSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [mounted, setMounted] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {
        // Ignore errors
      }
    }
  }, [settings, mounted]);

  const updateSettings = (partial: Partial<ReaderSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return (
    <ReaderSettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </ReaderSettingsContext.Provider>
  );
}

export function useReaderSettings() {
  const context = useContext(ReaderSettingsContext);
  if (!context) {
    throw new Error("useReaderSettings must be used within a ReaderSettingsProvider");
  }
  return context;
}

// Theme color definitions
export const themeColors = {
  dark: {
    background: "#0a0a0f",
    text: "#e2e8f0",
    textMuted: "#94a3b8",
    textPrimary: "#ffffff",
    accent: "#a78bfa",
    border: "rgba(255, 255, 255, 0.05)",
    headerBg: "rgba(10, 10, 15, 0.8)",
  },
  light: {
    background: "#fafaf9",
    text: "#1c1917",
    textMuted: "#78716c",
    textPrimary: "#0c0a09",
    accent: "#7c3aed",
    border: "#e7e5e4",
    headerBg: "rgba(250, 250, 249, 0.8)",
  },
  sepia: {
    background: "#fffbeb",
    text: "#451a03",
    textMuted: "#92400e",
    textPrimary: "#1c0a00",
    accent: "#b45309",
    border: "#fde68a",
    headerBg: "rgba(255, 251, 235, 0.8)",
  },
};

// Width values
export const widthValues = {
  narrow: "32rem",
  medium: "42rem",
  wide: "56rem",
};

// Font families
export const fontFamilies = {
  serif: "'Lora', Georgia, 'Times New Roman', serif",
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  mono: "'SF Mono', 'Fira Code', Monaco, monospace",
};

// Get theme colors object
export function getThemeColors(theme: ReaderTheme) {
  return themeColors[theme];
}

// Inline style helpers for reliable application
export function getContainerStyle(theme: ReaderTheme): CSSProperties {
  const colors = themeColors[theme];
  return {
    backgroundColor: colors.background,
    color: colors.text,
    minHeight: "100vh",
    transition: "background-color 0.3s ease, color 0.3s ease",
  };
}

export function getHeaderStyle(theme: ReaderTheme): CSSProperties {
  const colors = themeColors[theme];
  return {
    backgroundColor: colors.headerBg,
    borderColor: colors.border,
    backdropFilter: "blur(12px)",
  };
}

export function getContentWidthStyle(width: ReaderWidth): CSSProperties {
  return {
    maxWidth: widthValues[width],
    marginLeft: "auto",
    marginRight: "auto",
  };
}

export function getProseStyle(settings: ReaderSettings): CSSProperties {
  return {
    fontFamily: fontFamilies[settings.font],
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
  };
}

// CSS class helpers (keeping for backwards compatibility)
export function getThemeClasses(theme: ReaderTheme): string {
  switch (theme) {
    case "light":
      return "bg-stone-50 text-stone-900";
    case "sepia":
      return "bg-amber-50 text-amber-950";
    case "dark":
    default:
      return "bg-[#0a0a0f] text-slate-200";
  }
}

export function getFontClass(font: ReaderFont): string {
  switch (font) {
    case "sans":
      return "font-sans";
    case "mono":
      return "font-mono";
    case "serif":
    default:
      return "font-serif";
  }
}

export function getWidthClass(width: ReaderWidth): string {
  switch (width) {
    case "narrow":
      return "max-w-lg";
    case "wide":
      return "max-w-3xl";
    case "medium":
    default:
      return "max-w-2xl";
  }
}

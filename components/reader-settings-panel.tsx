"use client";

import { useEffect, useRef } from "react";
import {
  XMarkIcon,
  SunIcon,
  MoonIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import {
  useReaderSettings,
  ReaderTheme,
  ReaderFont,
  ReaderWidth,
  themeColors,
} from "@/lib/reader-settings";

interface ReaderSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReaderSettingsPanel({ isOpen, onClose }: ReaderSettingsPanelProps) {
  const { settings, updateSettings, resetSettings } = useReaderSettings();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && isOpen) {
        onClose();
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Get current theme colors
  const colors = themeColors[settings.theme];

  const themes: { value: ReaderTheme; label: string; icon: React.ReactNode }[] = [
    { value: "dark", label: "Dark", icon: <MoonIcon className="w-4 h-4" /> },
    { value: "light", label: "Light", icon: <SunIcon className="w-4 h-4" /> },
    { value: "sepia", label: "Sepia", icon: <div className="w-4 h-4 rounded-full bg-amber-200 border border-amber-400" /> },
  ];

  const fonts: { value: ReaderFont; label: string; preview: string }[] = [
    { value: "serif", label: "Serif", preview: "Aa" },
    { value: "sans", label: "Sans", preview: "Aa" },
    { value: "mono", label: "Mono", preview: "Aa" },
  ];

  const widths: { value: ReaderWidth; label: string }[] = [
    { value: "narrow", label: "Narrow" },
    { value: "medium", label: "Medium" },
    { value: "wide", label: "Wide" },
  ];

  // Panel styles based on theme
  const panelStyle = {
    backgroundColor: colors.background,
    borderColor: colors.border,
  };

  const buttonBaseStyle = {
    backgroundColor: `${colors.text}08`,
    borderColor: `${colors.text}20`,
    color: colors.textMuted,
  };

  const buttonActiveStyle = {
    backgroundColor: `${colors.accent}20`,
    borderColor: colors.accent,
    color: colors.accent,
  };

  const sliderTrackStyle = {
    backgroundColor: `${colors.text}20`,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Panel - slides up on mobile, centered on desktop */}
      <div
        ref={panelRef}
        className="relative w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto transform rounded-t-2xl sm:rounded-2xl border border-b-0 sm:border-b p-5 sm:p-6 shadow-xl animate-fade-in transition-colors"
        style={panelStyle}
      >
        {/* Drag indicator for mobile */}
        <div className="sm:hidden w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: `${colors.text}30` }} />

        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: colors.textPrimary }}>
            Reader Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg transition-colors"
            style={{ color: colors.textMuted }}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 sm:space-y-6">
          {/* Theme */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2.5 sm:mb-3" style={{ color: colors.textMuted }}>
              Theme
            </label>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => updateSettings({ theme: theme.value })}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition-all"
                  style={settings.theme === theme.value ? buttonActiveStyle : buttonBaseStyle}
                >
                  {theme.icon}
                  <span className="text-xs sm:text-sm">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2.5 sm:mb-3" style={{ color: colors.textMuted }}>
              Font
            </label>
            <div className="grid grid-cols-3 gap-2">
              {fonts.map((font) => (
                <button
                  key={font.value}
                  onClick={() => updateSettings({ font: font.value })}
                  className="flex flex-col items-center gap-0.5 sm:gap-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition-all"
                  style={settings.font === font.value ? buttonActiveStyle : buttonBaseStyle}
                >
                  <span className={`text-lg sm:text-xl ${
                    font.value === "serif" ? "font-serif" :
                    font.value === "sans" ? "font-sans" : "font-mono"
                  }`}>
                    {font.preview}
                  </span>
                  <span className="text-[10px] sm:text-xs">{font.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <label className="text-xs sm:text-sm font-medium" style={{ color: colors.textMuted }}>
                Font Size
              </label>
              <span className="text-xs sm:text-sm" style={{ color: colors.textMuted }}>{settings.fontSize}px</span>
            </div>
            <input
              type="range"
              min={14}
              max={24}
              step={1}
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ ...sliderTrackStyle, accentColor: colors.accent }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] sm:text-xs" style={{ color: `${colors.textMuted}80` }}>Smaller</span>
              <span className="text-[10px] sm:text-xs" style={{ color: `${colors.textMuted}80` }}>Larger</span>
            </div>
          </div>

          {/* Line Height */}
          <div>
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <label className="text-xs sm:text-sm font-medium" style={{ color: colors.textMuted }}>
                Line Spacing
              </label>
              <span className="text-xs sm:text-sm" style={{ color: colors.textMuted }}>{settings.lineHeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={1.5}
              max={2.2}
              step={0.05}
              value={settings.lineHeight}
              onChange={(e) => updateSettings({ lineHeight: parseFloat(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ ...sliderTrackStyle, accentColor: colors.accent }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] sm:text-xs" style={{ color: `${colors.textMuted}80` }}>Compact</span>
              <span className="text-[10px] sm:text-xs" style={{ color: `${colors.textMuted}80` }}>Relaxed</span>
            </div>
          </div>

          {/* Reading Width */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2.5 sm:mb-3" style={{ color: colors.textMuted }}>
              Reading Width
            </label>
            <div className="grid grid-cols-3 gap-2">
              {widths.map((width) => (
                <button
                  key={width.value}
                  onClick={() => updateSettings({ width: width.value })}
                  className="px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition-all"
                  style={settings.width === width.value ? buttonActiveStyle : buttonBaseStyle}
                >
                  <div className="flex justify-center mb-1.5 sm:mb-2">
                    <div className={`h-2.5 sm:h-3 bg-current rounded opacity-50 ${
                      width.value === "narrow" ? "w-6 sm:w-8" :
                      width.value === "medium" ? "w-9 sm:w-12" : "w-12 sm:w-16"
                    }`} />
                  </div>
                  <span className="text-xs sm:text-sm">{width.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reset Button */}
        <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t" style={{ borderColor: colors.border }}>
          <button
            onClick={resetSettings}
            className="flex items-center gap-2 text-xs sm:text-sm transition-colors"
            style={{ color: colors.textMuted }}
          >
            <ArrowPathIcon className="w-4 h-4" />
            Reset to defaults
          </button>
        </div>

        {/* Safe area padding for mobile */}
        <div className="h-4 sm:h-0" />
      </div>
    </div>
  );
}

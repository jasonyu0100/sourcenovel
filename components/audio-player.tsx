"use client";

import { useState, useRef, useEffect } from "react";
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";

interface ThemeColors {
  background: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
}

interface AudioPlayerProps {
  src: string;
  autoPlay?: boolean;
  onError?: () => void;
  themeColors?: ThemeColors;
}

// Default dark theme colors for fallback
const defaultColors: ThemeColors = {
  background: "#0a0a0f",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  accent: "#a78bfa",
  border: "rgba(255, 255, 255, 0.05)",
};

export function AudioPlayer({ src, autoPlay = false, onError, themeColors }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLooping, setIsLooping] = useState(true);

  // Use provided theme colors or fall back to defaults
  const colors = themeColors || defaultColors;

  // Set up audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (isLooping) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        setIsPlaying(false);
      }
    };
    const handleError = () => {
      setHasError(true);
      onError?.();
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [onError, isLooping]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Don't render if there's an error
  if (hasError) {
    return null;
  }

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Container and track background styles based on theme
  const containerStyle = {
    backgroundColor: `${colors.background}e6`, // 90% opacity
    borderColor: colors.border,
  };

  const trackBgStyle = {
    backgroundColor: `${colors.text}20`,
  };

  return (
    <div
      className="flex items-center gap-2 sm:gap-3 backdrop-blur-xl rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border shadow-lg shadow-black/20 transition-colors"
      style={containerStyle}
    >
      <audio ref={audioRef} src={src} preload="metadata" loop={isLooping} />

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-full transition-all hover:scale-105 shadow-lg"
        style={{ backgroundColor: colors.accent, boxShadow: `0 4px 14px ${colors.accent}33` }}
      >
        {isPlaying ? (
          <PauseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        ) : (
          <PlayIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white ml-0.5" />
        )}
      </button>

      {/* Progress section */}
      <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0">
        <span
          className="text-[10px] sm:text-xs w-8 sm:w-10 text-right font-mono flex-shrink-0"
          style={{ color: colors.textMuted }}
        >
          {formatTime(currentTime)}
        </span>

        <div
          className="flex-1 relative h-1.5 rounded-full overflow-hidden min-w-[60px]"
          style={trackBgStyle}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-100"
            style={{
              width: `${progressPercent}%`,
              background: `linear-gradient(to right, ${colors.accent}, ${colors.accent}cc)`,
            }}
          />
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <span
          className="text-[10px] sm:text-xs w-8 sm:w-10 font-mono flex-shrink-0"
          style={{ color: colors.textMuted }}
        >
          {formatTime(duration)}
        </span>
      </div>

      {/* Loop toggle - hidden on very small screens */}
      <button
        onClick={() => setIsLooping(!isLooping)}
        className="hidden xs:flex p-1.5 sm:p-2 rounded-lg transition-all"
        style={{
          color: isLooping ? colors.accent : colors.textMuted,
          backgroundColor: isLooping ? `${colors.accent}1a` : "transparent",
        }}
        title={isLooping ? "Looping enabled" : "Looping disabled"}
      >
        <ArrowPathIcon className="w-4 h-4" />
      </button>

      {/* Volume controls - mute button always visible, slider hidden on mobile */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        className="transition-colors p-1 flex-shrink-0"
        style={{ color: colors.textMuted }}
      >
        {isMuted || volume === 0 ? (
          <SpeakerXMarkIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : (
          <SpeakerWaveIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
      </button>

      {/* Volume slider - hidden on mobile */}
      <div
        className="relative w-16 h-1.5 rounded-full overflow-hidden hidden sm:block"
        style={trackBgStyle}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${(isMuted ? 0 : volume) * 100}%`,
            backgroundColor: colors.textMuted,
          }}
        />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={isMuted ? 0 : volume}
          onChange={(e) => {
            setVolume(parseFloat(e.target.value));
            if (isMuted) setIsMuted(false);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { Attachment } from "@/hooks/useTopicSocket";

interface Props {
  attachment: Attachment;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M3 2.25L9.75 6 3 9.75V2.25Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <rect x="2.5" y="2" width="3" height="8" rx="0.75" />
      <rect x="6.5" y="2" width="3" height="8" rx="0.75" />
    </svg>
  );
}

export function AudioPlayer({ attachment }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(attachment.duration ?? 0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onDurationChange = () => {
      if (isFinite(el.duration)) setDuration(el.duration);
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("loadedmetadata", onDurationChange);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("loadedmetadata", onDurationChange);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  }, [playing]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const t = Number(e.target.value);
    el.currentTime = t;
    setCurrentTime(t);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-xl"
      style={{
        background: "var(--color-blue-dim)",
        border: "1px solid var(--color-blue-border)",
        maxWidth: 300,
      }}
    >
      {/* Hidden native audio element */}
      <audio ref={audioRef} src={attachment.url} preload="metadata" />

      {/* Play/Pause button */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pausar" : "Reproduzir"}
        className="w-7 h-7 rounded-full bg-blue text-white flex items-center justify-center shrink-0 hover:bg-blue/80 transition-colors"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* Progress bar + time */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Posição do áudio"
          className="w-full h-[3px] cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, var(--color-blue) ${progress}%, var(--color-border) ${progress}%)`,
          }}
        />
        <div className="flex justify-between text-[10px] text-text-3 font-mono leading-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

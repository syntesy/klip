"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlbumPhoto {
  id: string;
  storageUrl: string;
  thumbnailUrl: string;
  blurUrl?: string | null;
  caption?: string | null;
  displayOrder: number;
}

interface AlbumViewerProps {
  albumTitle: string;
  photos: AlbumPhoto[];
  initialIndex?: number;
  onClose: () => void;
}

// ─── AlbumViewer ──────────────────────────────────────────────────────────────

export function AlbumViewer({ albumTitle, photos, initialIndex = 0, onClose }: AlbumViewerProps) {
  const [current, setCurrent] = useState(initialIndex);
  const [downloading, setDownloading] = useState(false);

  const photo = photos[current];

  const prev = useCallback(() => setCurrent((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setCurrent((i) => Math.min(photos.length - 1, i + 1)), [photos.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape")     onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, onClose]);

  async function handleDownload() {
    if (!photo || downloading) return;
    setDownloading(true);
    try {
      // Safari iOS blocks cross-origin <a download> — open in new tab instead
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        window.open(photo.storageUrl, "_blank");
        return;
      }
      const response = await fetch(photo.storageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `klip-album-${photo.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // non-fatal
    } finally {
      setDownloading(false);
    }
  }

  if (!photo) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,.92)",
        display: "flex", flexDirection: "column",
        height: "100dvh",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", flexShrink: 0,
        borderBottom: "1px solid rgba(255,255,255,.08)",
      }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{albumTitle}</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,.45)", margin: 0 }}>
            {current + 1} / {photos.length}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Download */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label="Baixar foto"
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)",
              color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)",
              color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Main photo */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", maxWidth: 900, margin: "0 auto" }}>
          <Image
            key={photo.id}
            src={photo.storageUrl}
            alt={photo.caption ?? `Foto ${current + 1}`}
            fill
            style={{ objectFit: "contain" }}
            unoptimized
            priority
          />
        </div>

        {/* Prev arrow */}
        {current > 0 && (
          <button
            type="button"
            onClick={prev}
            aria-label="Anterior"
            style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.15)",
              color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {/* Next arrow */}
        {current < photos.length - 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="Próxima"
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.15)",
              color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Caption */}
      {photo.caption && photos.length <= 1 && (
        <div style={{
          padding: "10px 18px",
          paddingBottom: "max(10px, env(safe-area-inset-bottom))",
          flexShrink: 0, borderTop: "1px solid rgba(255,255,255,.08)",
        }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,.70)", margin: 0 }}>{photo.caption}</p>
        </div>
      )}

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div style={{
          display: "flex", gap: 6,
          padding: "10px 18px",
          paddingBottom: "max(10px, env(safe-area-inset-bottom))",
          overflowX: "auto",
          flexShrink: 0, borderTop: "1px solid rgba(255,255,255,.08)",
        }}>
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setCurrent(i)}
              style={{
                width: 52, height: 52, flexShrink: 0, padding: 0, cursor: "pointer",
                border: i === current ? "2px solid #4A9EFF" : "2px solid transparent",
                borderRadius: 6, overflow: "hidden", background: "rgba(255,255,255,.06)",
                position: "relative",
              }}
            >
              <Image
                src={p.thumbnailUrl}
                alt={`Miniatura ${i + 1}`}
                fill
                style={{ objectFit: "cover" }}
                unoptimized
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

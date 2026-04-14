"use client";

import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlbumPreviewPhoto {
  id: string;
  blurUrl?: string | null;
  thumbnailUrl?: string | null;
  storageUrl?: string | null;
}

export interface AlbumCardData {
  id: string;
  title: string;
  description?: string | null;
  coverPhotoUrl?: string | null;
  isPremium: boolean;
  price?: string | null;
  photoCount: number;
  hasPurchased: boolean;
  previewPhotos: AlbumPreviewPhoto[];
}

interface AlbumCardProps {
  album: AlbumCardData;
  onView: (albumId: string) => void;
  onPurchase: (albumId: string) => void;
  purchasing?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: string | null | undefined): string {
  if (!price) return "";
  const n = parseFloat(price);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── AlbumCard ────────────────────────────────────────────────────────────────

export function AlbumCard({ album, onView, onPurchase, purchasing = false }: AlbumCardProps) {
  const isLocked = album.isPremium && !album.hasPurchased;
  const coverUrl = album.coverPhotoUrl ?? album.previewPhotos[0]?.thumbnailUrl ?? album.previewPhotos[0]?.blurUrl ?? null;

  return (
    <div
      style={{
        background: "var(--color-bg-surface)",
        border: isLocked ? "1px solid rgba(245,169,74,.25)" : "1px solid var(--color-border)",
        borderRadius: 14,
        overflow: "hidden",
        margin: "3px 12px",
      }}
    >
      {/* Cover / preview grid */}
      <div style={{ position: "relative", height: 160, background: "var(--color-bg-muted)" }}>
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={album.title}
            fill
            style={{
              objectFit: "cover",
              filter: isLocked ? "blur(12px) brightness(0.6)" : "none",
              transform: isLocked ? "scale(1.08)" : "none",
              transition: "filter 0.3s, transform 0.3s",
            }}
            unoptimized
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="1.2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        {/* Lock overlay */}
        {isLocked && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F5A94A" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#F5A94A", letterSpacing: "0.05em" }}>PREMIUM</span>
          </div>
        )}

        {/* Photo count badge */}
        <div style={{
          position: "absolute", bottom: 8, right: 8,
          background: "rgba(0,0,0,.55)", borderRadius: 20,
          padding: "3px 8px", display: "flex", alignItems: "center", gap: 4,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{album.photoCount}</span>
        </div>

        {/* Purchased badge */}
        {album.hasPurchased && album.isPremium && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            background: "rgba(34,201,138,.18)", border: "1px solid rgba(34,201,138,.35)",
            borderRadius: 20, padding: "2px 8px",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#22C98A" }}>COMPRADO</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px" }}>
        {/* Title + premium badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-1)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {album.title}
          </span>
          {album.isPremium && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#F5A94A",
              background: "rgba(245,169,74,.10)", border: "1px solid rgba(245,169,74,.25)",
              borderRadius: 20, padding: "2px 7px", flexShrink: 0,
            }}>
              {isLocked ? formatPrice(album.price) : "Premium"}
            </span>
          )}
        </div>

        {album.description && (
          <p style={{ fontSize: 12, color: "var(--color-text-3)", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
            {album.description}
          </p>
        )}

        {/* Action button */}
        <button
          type="button"
          onClick={() => isLocked ? onPurchase(album.id) : onView(album.id)}
          disabled={purchasing}
          style={{
            width: "100%",
            padding: "9px",
            borderRadius: 8,
            border: "none",
            background: isLocked ? "#F5A94A" : "#4A9EFF",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: purchasing ? "wait" : "pointer",
            opacity: purchasing ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {isLocked ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {purchasing ? "Processando…" : `Comprar ${formatPrice(album.price)}`}
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Ver álbum
            </>
          )}
        </button>
      </div>
    </div>
  );
}

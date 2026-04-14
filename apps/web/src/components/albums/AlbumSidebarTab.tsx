"use client";

import Image from "next/image";
import type { AlbumCardData } from "./AlbumCard";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AlbumSidebarTabProps {
  albums: AlbumCardData[];
  onOpenAlbum: (albumId: string) => void;
  onPurchase: (albumId: string) => void;
  isOwnerOrMod: boolean;
  onCreateAlbum: () => void;
  purchasingId?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: string | null | undefined): string {
  if (!price) return "";
  const n = parseFloat(price);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── AlbumSidebarTab ─────────────────────────────────────────────────────────

export function AlbumSidebarTab({
  albums,
  onOpenAlbum,
  onPurchase,
  isOwnerOrMod,
  onCreateAlbum,
  purchasingId,
}: AlbumSidebarTabProps) {
  if (albums.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 32, textAlign: "center" }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="1.2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-2)", margin: 0 }}>
          Nenhum álbum ainda
        </p>
        {isOwnerOrMod && (
          <button
            type="button"
            onClick={onCreateAlbum}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "#4A9EFF", color: "#fff", border: "none", cursor: "pointer",
            }}
          >
            + Criar álbum
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Create button for admins */}
      {isOwnerOrMod && (
        <button
          type="button"
          onClick={onCreateAlbum}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 0", marginBottom: 12,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600, color: "#4A9EFF",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo álbum
        </button>
      )}

      {albums.map((album) => {
        const isLocked = album.isPremium && !album.hasPurchased;
        const coverUrl = album.coverPhotoUrl ?? album.previewPhotos[0]?.thumbnailUrl ?? album.previewPhotos[0]?.blurUrl ?? null;
        const isPurchasing = purchasingId === album.id;

        return (
          <div
            key={album.id}
            style={{
              display: "flex", gap: 10, alignItems: "center",
              padding: "10px 0",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {/* Thumbnail */}
            <div style={{
              width: 52, height: 52, borderRadius: 8, flexShrink: 0,
              background: "var(--color-bg-muted)", overflow: "hidden",
              position: "relative",
            }}>
              {coverUrl ? (
                <Image
                  src={coverUrl}
                  alt={album.title}
                  fill
                  style={{
                    objectFit: "cover",
                    filter: isLocked ? "blur(6px) brightness(0.6)" : "none",
                    transform: isLocked ? "scale(1.1)" : "none",
                  }}
                  unoptimized
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-3)" strokeWidth="1.5" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}

              {isLocked && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5A94A" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-text-1)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {album.title}
              </p>
              <p style={{ fontSize: 11, color: "var(--color-text-3)", margin: "2px 0 0" }}>
                {album.photoCount} {album.photoCount === 1 ? "foto" : "fotos"}
                {album.isPremium && (
                  <span style={{ marginLeft: 5, color: album.hasPurchased ? "#22C98A" : "#F5A94A", fontWeight: 600 }}>
                    · {album.hasPurchased ? "Comprado" : formatPrice(album.price)}
                  </span>
                )}
              </p>
            </div>

            {/* Action */}
            <button
              type="button"
              onClick={() => isLocked ? onPurchase(album.id) : onOpenAlbum(album.id)}
              disabled={isPurchasing}
              style={{
                padding: "5px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                background: isLocked ? "rgba(245,169,74,.12)" : "rgba(74,158,255,.12)",
                border: isLocked ? "1px solid rgba(245,169,74,.25)" : "1px solid rgba(74,158,255,.25)",
                color: isLocked ? "#F5A94A" : "#4A9EFF",
                cursor: isPurchasing ? "wait" : "pointer",
                flexShrink: 0,
                opacity: isPurchasing ? 0.6 : 1,
              }}
            >
              {isLocked ? (isPurchasing ? "…" : "Comprar") : "Ver"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhotoPreview {
  file: File;
  localUrl: string;
  isCover: boolean;
}

interface AlbumCreateModalProps {
  communityId: string;
  topicId?: string;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onCreated?: (albumId: string) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── AlbumCreateModal ─────────────────────────────────────────────────────────

export function AlbumCreateModal({
  communityId,
  topicId,
  getToken,
  onClose,
  onCreated,
}: AlbumCreateModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [price, setPrice] = useState("");
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [step, setStep] = useState<"form" | "uploading" | "done">("form");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const previews: PhotoPreview[] = arr.map((file, i) => ({
      file,
      localUrl: URL.createObjectURL(file),
      isCover: photos.length === 0 && i === 0, // first photo auto-selected as cover
    }));
    setPhotos((prev) => {
      const next = [...prev, ...previews];
      // If no cover yet, mark first
      if (!next.some((p) => p.isCover) && next.length > 0) next[0]!.isCover = true;
      return next;
    });
  }, [photos.length]);

  function setCover(idx: number) {
    setPhotos((prev) => prev.map((p, i) => ({ ...p, isCover: i === idx })));
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (prev[idx]?.isCover && next.length > 0) next[0]!.isCover = true;
      return next;
    });
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (dropRef.current) dropRef.current.style.borderColor = "#4A9EFF";
  }
  function onDragLeave() {
    if (dropRef.current) dropRef.current.style.borderColor = "rgba(255,255,255,.12)";
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    onDragLeave();
    addFiles(e.dataTransfer.files);
  }

  async function handleSubmit() {
    if (!title.trim()) { setError("Título é obrigatório"); return; }
    if (isPremium && (!price || parseFloat(price) <= 0)) { setError("Informe um preço válido"); return; }

    setStep("uploading");
    setError(null);

    try {
      const token = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Create album as draft
      const createRes = await fetch(`${API_URL}/api/communities/${communityId}/albums`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          isPremium,
          price: isPremium && price ? parseFloat(price) : undefined,
          topicId: topicId ?? undefined,
          status: "draft",
        }),
      });

      if (!createRes.ok) throw new Error("Falha ao criar álbum");
      const album = await createRes.json() as { id: string };

      // 2. Upload photos
      let coverUrl: string | null = null;
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i]!;
        const formData = new FormData();
        formData.append("file", p.file);

        const uploadRes = await fetch(`${API_URL}/api/albums/${album.id}/photos`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (uploadRes.ok) {
          const photo = await uploadRes.json() as { storageUrl: string };
          if (p.isCover) coverUrl = photo.storageUrl;
        }

        setUploadProgress(Math.round(((i + 1) / photos.length) * 100));
      }

      // 3. Publish
      await fetch(`${API_URL}/api/albums/${album.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(coverUrl ? { coverPhotoUrl: coverUrl } : {}),
          status: "published",
        }),
      });

      setStep("done");
      onCreated?.(album.id);
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar álbum");
      setStep("form");
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.55)",
    textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6, display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)",
    color: "#fff", fontSize: 13, outline: "none",
    boxSizing: "border-box" as const,
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#0B1628", border: "1px solid #1a2e4a",
        borderRadius: 18, padding: 24, width: "min(520px, 95vw)",
        maxHeight: "90dvh", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Criar álbum</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {step === "done" ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22C98A" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: 0 }}>Álbum publicado!</p>
          </div>
        ) : (
          <>
            {/* Title */}
            <div>
              <label style={labelStyle}>Título</label>
              <input
                style={inputStyle}
                placeholder="Ex: Resultados Turma Março"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                disabled={step === "uploading"}
              />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Descrição (opcional)</label>
              <textarea
                style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
                placeholder="Descreva o álbum…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                disabled={step === "uploading"}
              />
            </div>

            {/* Premium toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>Álbum premium</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,.40)", margin: "2px 0 0" }}>Membros precisam pagar para ver as fotos</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPremium((v) => !v)}
                disabled={step === "uploading"}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: isPremium ? "#4A9EFF" : "rgba(255,255,255,.12)",
                  position: "relative", transition: "background .2s", flexShrink: 0,
                }}
                aria-checked={isPremium}
                role="switch"
              >
                <span style={{
                  position: "absolute", top: 2, width: 20, height: 20, borderRadius: "50%",
                  background: "#fff", transition: "left .2s",
                  left: isPremium ? 22 : 2,
                }} />
              </button>
            </div>

            {/* Price */}
            {isPremium && (
              <div>
                <label style={labelStyle}>Preço</label>
                <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  <span style={{ padding: "10px 12px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.10)", borderRight: "none", borderRadius: "10px 0 0 10px", color: "rgba(255,255,255,.55)", fontSize: 13 }}>R$</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    style={{ ...inputStyle, borderRadius: "0 10px 10px 0", flex: 1 }}
                    placeholder="9,90"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={step === "uploading"}
                  />
                </div>
              </div>
            )}

            {/* Photo dropzone */}
            <div>
              <label style={labelStyle}>Fotos</label>
              <div
                ref={dropRef}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "1.5px dashed rgba(255,255,255,.12)",
                  borderRadius: 12, padding: "20px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  cursor: "pointer", transition: "border-color .2s",
                  background: "rgba(255,255,255,.02)",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.5" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,.4)", margin: 0 }}>
                  Arraste fotos ou toque para selecionar
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                  disabled={step === "uploading"}
                />
              </div>
            </div>

            {/* Preview grid */}
            {photos.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", cursor: "pointer" }}
                    onClick={() => setCover(i)}
                  >
                    <Image src={p.localUrl} alt={`Foto ${i + 1}`} fill style={{ objectFit: "cover" }} unoptimized />
                    {/* Cover badge */}
                    {p.isCover && (
                      <div style={{
                        position: "absolute", bottom: 4, left: 4,
                        background: "#4A9EFF", borderRadius: 20, padding: "2px 7px",
                        fontSize: 9, fontWeight: 700, color: "#fff",
                      }}>
                        Capa
                      </div>
                    )}
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                      style={{
                        position: "absolute", top: 4, right: 4,
                        width: 20, height: 20, borderRadius: "50%",
                        background: "rgba(0,0,0,.65)", border: "none",
                        color: "#fff", fontSize: 14, lineHeight: 1,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload progress */}
            {step === "uploading" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>Enviando fotos…</span>
                  <span style={{ fontSize: 12, color: "#4A9EFF", fontWeight: 600 }}>{uploadProgress}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${uploadProgress}%`, background: "#4A9EFF", transition: "width .3s", borderRadius: 4 }} />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p style={{ fontSize: 12, color: "#E8504A", margin: 0 }}>{error}</p>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={step === "uploading"}
                style={{
                  flex: 1, padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 500,
                  background: "transparent", border: "1px solid rgba(255,255,255,.10)",
                  color: "rgba(255,255,255,.70)", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={step === "uploading" || !title.trim()}
                style={{
                  flex: 1, padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: "#4A9EFF", border: "none", color: "#fff",
                  cursor: step === "uploading" || !title.trim() ? "not-allowed" : "pointer",
                  opacity: step === "uploading" || !title.trim() ? 0.6 : 1,
                }}
              >
                {step === "uploading" ? "Publicando…" : photos.length > 0 ? `Publicar (${photos.length} foto${photos.length > 1 ? "s" : ""})` : "Publicar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { Message } from "@/components/chat/MessageFeed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ContentType = "video" | "audio" | "document" | "image" | "text";

interface MakePremiumModalProps {
  message: Message;
  communityId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function formatPriceInput(raw: string): string {
  // Keep only digits
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePriceCents(formatted: string): number {
  return Math.round(parseFloat(formatted.replace(/\./g, "").replace(",", ".")) * 100);
}

export function MakePremiumModal({ message, communityId, onClose, onSuccess }: MakePremiumModalProps) {
  const { getToken } = useAuth();
  const [title, setTitle] = useState(message.content.slice(0, 100));
  const [priceDisplay, setPriceDisplay] = useState("9,90");
  const [contentType, setContentType] = useState<ContentType>("text");
  const [previewText, setPreviewText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const priceCents = parsePriceCents(priceDisplay);
    if (priceCents < 100) {
      setError("Preço mínimo: R$1,00");
      return;
    }
    if (!title.trim()) {
      setError("Título obrigatório");
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/premium/klip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token!}`,
        },
        body: JSON.stringify({
          communityId,
          klipId: undefined,
          title: title.trim(),
          price: priceCents,
          contentType,
          previewText: previewText.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Erro ao publicar");
        return;
      }

      onSuccess();
    } catch {
      setError("Falha na conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const CONTENT_TYPES: { value: ContentType; label: string }[] = [
    { value: "text", label: "Texto" },
    { value: "video", label: "Vídeo" },
    { value: "audio", label: "Áudio" },
    { value: "document", label: "Documento" },
    { value: "image", label: "Imagem" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Publicar na Área Premium"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="relative w-full md:max-w-md bg-bg-surface rounded-t-2xl md:rounded-2xl p-6 shadow-2xl z-10"
        style={{ border: "1px solid var(--color-border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[17px] font-bold text-text-1" style={{ letterSpacing: "-0.3px" }}>
            ⭐ Publicar na Área Premium
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-text-3 hover:text-text-1 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className="block text-[12px] font-semibold text-text-2 mb-1">
              Título do conteúdo
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              placeholder="Ex: Resumo da decisão sobre produto"
              className="w-full px-3 py-2 rounded-lg text-[13px] text-text-1 outline-none transition-colors"
              style={{
                background: "var(--color-input-bg)",
                border: "1px solid var(--color-input-border)",
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "var(--color-blue-border)";
                (e.target as HTMLInputElement).style.background = "var(--color-input-bg-focus)";
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "var(--color-input-border)";
                (e.target as HTMLInputElement).style.background = "var(--color-input-bg)";
              }}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-[12px] font-semibold text-text-2 mb-1">
              Tipo de conteúdo
            </label>
            <div className="flex gap-2 flex-wrap">
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => setContentType(ct.value)}
                  className="text-[12px] font-medium px-3 py-1 rounded-full transition-colors"
                  style={{
                    background: contentType === ct.value ? "var(--color-blue)" : "var(--color-bg-subtle)",
                    color: contentType === ct.value ? "#fff" : "var(--color-text-2)",
                    border: contentType === ct.value ? "1px solid var(--color-blue)" : "1px solid var(--color-border)",
                  }}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-[12px] font-semibold text-text-2 mb-1">
              Preço
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-text-2">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={priceDisplay}
                onChange={(e) => {
                  const formatted = formatPriceInput(e.target.value);
                  if (formatted !== "") setPriceDisplay(formatted);
                }}
                required
                className="w-full px-3 py-2 rounded-lg text-[13px] text-text-1 outline-none transition-colors"
                style={{
                  background: "var(--color-input-bg)",
                  border: "1px solid var(--color-input-border)",
                }}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "var(--color-blue-border)";
                  (e.target as HTMLInputElement).style.background = "var(--color-input-bg-focus)";
                }}
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "var(--color-input-border)";
                  (e.target as HTMLInputElement).style.background = "var(--color-input-bg)";
                }}
              />
            </div>
          </div>

          {/* Preview text */}
          <div>
            <label className="block text-[12px] font-semibold text-text-2 mb-1">
              Texto de preview <span className="font-normal text-text-3">(opcional — aparece antes da compra)</span>
            </label>
            <textarea
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Descreva o conteúdo sem spoilers…"
              className="w-full px-3 py-2 rounded-lg text-[13px] text-text-1 outline-none transition-colors resize-none"
              style={{
                background: "var(--color-input-bg)",
                border: "1px solid var(--color-input-border)",
              }}
              onFocus={(e) => {
                (e.target as HTMLTextAreaElement).style.borderColor = "var(--color-blue-border)";
                (e.target as HTMLTextAreaElement).style.background = "var(--color-input-bg-focus)";
              }}
              onBlur={(e) => {
                (e.target as HTMLTextAreaElement).style.borderColor = "var(--color-input-border)";
                (e.target as HTMLTextAreaElement).style.background = "var(--color-input-bg)";
              }}
            />
          </div>
        </div>

        {error && (
          <p className="text-[12px] text-red-500 mt-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-5 py-3 rounded-xl text-[14px] font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: "var(--color-blue)" }}
        >
          {loading ? "Publicando…" : "Publicar na Área Premium"}
        </button>
      </form>
    </div>
  );
}

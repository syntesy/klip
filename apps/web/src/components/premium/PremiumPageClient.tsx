"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentType = "video" | "audio" | "document" | "image" | "text";

export interface PremiumKlip {
  id: string;
  communityId: string;
  klipId: string | null;
  title: string;
  price: number;
  contentType: ContentType;
  contentUrl: string | null;
  previewText: string | null;
  purchaseCount: number;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

interface PremiumPageClientProps {
  communityId: string;
  communityName: string;
  initialKlips: unknown[];
  initialPurchasedIds: string[];
  canManage: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function contentTypeLabel(type: ContentType): string {
  const labels: Record<ContentType, string> = {
    video: "Vídeo",
    audio: "Áudio",
    document: "Documento",
    image: "Imagem",
    text: "Texto",
  };
  return labels[type];
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ContentTypeIcon({ type, size = 24 }: { type: ContentType; size?: number }) {
  const s = size;
  if (type === "video") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <polygon points="10,9 16,12 10,15" fill="currentColor" stroke="none" />
    </svg>
  );
  if (type === "audio") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  );
  if (type === "document") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
  if (type === "image") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  );
  // text
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="10" x2="20" y2="10" /><line x1="4" y1="14" x2="14" y2="14" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="7" width="10" height="8" rx="1.5" />
      <path d="M5 7V5a3 3 0 016 0v2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="2 7 6 11 12 3" />
    </svg>
  );
}

// ─── Content viewer ───────────────────────────────────────────────────────────

function ContentViewer({ klip }: { klip: PremiumKlip }) {
  if (!klip.contentUrl) {
    return (
      <div className="flex items-center justify-center py-10 text-text-3 text-sm">
        Conteúdo ainda não disponível
      </div>
    );
  }

  if (klip.contentType === "video") {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        controls
        src={klip.contentUrl}
        className="w-full rounded-xl max-h-[360px] bg-black"
      />
    );
  }
  if (klip.contentType === "audio") {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <audio controls src={klip.contentUrl} className="w-full" />
    );
  }
  if (klip.contentType === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={klip.contentUrl}
        alt={klip.title}
        className="w-full rounded-xl max-h-[480px] object-contain bg-bg-subtle"
      />
    );
  }
  if (klip.contentType === "document") {
    return (
      <a
        href={klip.contentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-4 rounded-xl border border-border bg-bg-subtle hover:bg-bg-muted transition-colors text-text-1 no-underline"
      >
        <ContentTypeIcon type="document" size={20} />
        <span className="text-[14px] font-medium">Baixar documento</span>
      </a>
    );
  }
  // text
  return (
    <div
      className="p-5 rounded-xl bg-bg-subtle border border-border text-[14px] text-text-1 leading-relaxed whitespace-pre-wrap"
    >
      {klip.contentUrl}
    </div>
  );
}

// ─── Purchase modal ───────────────────────────────────────────────────────────

function PurchaseModal({
  klip,
  onClose,
  onSuccess,
}: {
  klip: PremiumKlip;
  onClose: () => void;
  onSuccess: (klipId: string) => void;
}) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/premium/${klip.id}/purchase`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token!}` },
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Erro ao processar compra");
        return;
      }
      onSuccess(klip.id);
    } catch {
      setError("Falha na conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Comprar ${klip.title}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative w-full md:max-w-sm bg-bg-surface rounded-t-2xl md:rounded-2xl p-6 shadow-2xl z-10"
        style={{ border: "1px solid var(--color-border)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-text-3 text-[12px]">
            <ContentTypeIcon type={klip.contentType} size={14} />
            {contentTypeLabel(klip.contentType)}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-text-3 hover:text-text-1 transition-colors shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        <h2 className="text-[18px] font-bold text-text-1 mb-2" style={{ letterSpacing: "-0.3px" }}>
          {klip.title}
        </h2>

        {klip.previewText && (
          <p className="text-[13px] text-text-2 leading-relaxed mb-4 p-3 rounded-lg bg-bg-subtle border border-border">
            {klip.previewText}
          </p>
        )}

        {/* Price */}
        <div
          className="flex items-center justify-between p-4 rounded-xl mb-4"
          style={{ background: "var(--color-blue-dim)", border: "1px solid var(--color-blue-border)" }}
        >
          <span className="text-[13px] text-text-2">Acesso vitalício</span>
          <span className="text-[22px] font-bold text-blue" style={{ letterSpacing: "-0.5px" }}>
            {formatPrice(klip.price)}
          </span>
        </div>

        {error && (
          <p className="text-[12px] text-red-500 mb-3 text-center">{error}</p>
        )}

        <button
          type="button"
          onClick={() => void handlePurchase()}
          disabled={loading}
          className="w-full py-3 rounded-xl text-[14px] font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: "var(--color-blue)" }}
        >
          {loading ? "Processando…" : `Comprar agora — ${formatPrice(klip.price)}`}
        </button>

        <p className="text-[11px] text-text-3 text-center mt-3">
          Acesso vitalício · Sem assinatura · Pagamento seguro
        </p>
      </div>
    </div>
  );
}

// ─── Access modal ─────────────────────────────────────────────────────────────

function AccessModal({
  klip,
  onClose,
}: {
  klip: PremiumKlip;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={klip.title}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full md:max-w-xl bg-bg-surface rounded-t-2xl md:rounded-2xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 text-[12px] text-text-3 mb-1">
              <ContentTypeIcon type={klip.contentType} size={13} />
              {contentTypeLabel(klip.contentType)}
            </div>
            <h2 className="text-[18px] font-bold text-text-1" style={{ letterSpacing: "-0.3px" }}>
              {klip.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-text-3 hover:text-text-1 transition-colors shrink-0 mt-1"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        <ContentViewer klip={klip} />
      </div>
    </div>
  );
}

// ─── Premium Card ─────────────────────────────────────────────────────────────

function PremiumCard({
  klip,
  owned,
  onBuy,
  onView,
}: {
  klip: PremiumKlip;
  owned: boolean;
  onBuy: (klip: PremiumKlip) => void;
  onView: (klip: PremiumKlip) => void;
}) {
  return (
    <div
      className="relative flex flex-col rounded-2xl overflow-hidden transition-shadow hover:shadow-md"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Thumbnail */}
      <div
        className="flex items-center justify-center h-[120px] shrink-0"
        style={{
          background: owned
            ? "linear-gradient(135deg, rgba(13,155,106,.12), rgba(13,155,106,.04))"
            : "var(--color-bg-subtle)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <span style={{ color: owned ? "var(--color-green)" : "var(--color-text-3)", opacity: 0.6 }}>
          <ContentTypeIcon type={klip.contentType} size={36} />
        </span>
      </div>

      {/* Status badge */}
      <div className="absolute top-3 right-3">
        {owned ? (
          <span
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
            style={{
              background: "var(--color-green-dim)",
              color: "var(--color-green)",
              border: "1px solid var(--color-green-border)",
            }}
          >
            <CheckIcon /> Você tem acesso
          </span>
        ) : (
          <span
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full"
            style={{
              background: "var(--color-bg-surface)",
              color: "var(--color-text-3)",
              border: "1px solid var(--color-border)",
            }}
          >
            <LockIcon />
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div>
          <p className="text-[11px] text-text-3 mb-1">{contentTypeLabel(klip.contentType)}</p>
          <h3 className="text-[15px] font-semibold text-text-1 leading-snug" style={{ letterSpacing: "-0.2px" }}>
            {klip.title}
          </h3>
        </div>

        {klip.previewText && !owned && (
          <p className="text-[12px] text-text-3 leading-relaxed line-clamp-2">
            {klip.previewText}
          </p>
        )}

        {/* Social proof */}
        <p className="text-[11px] text-text-3">
          {klip.purchaseCount === 0
            ? "Seja o primeiro a desbloquear"
            : `${klip.purchaseCount} ${klip.purchaseCount === 1 ? "pessoa comprou" : "pessoas compraram"}`}
        </p>

        {/* CTA */}
        <div className="mt-auto pt-1">
          {owned ? (
            <button
              type="button"
              onClick={() => onView(klip)}
              className="w-full py-2 rounded-xl text-[13px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--color-green)", color: "#fff" }}
            >
              Acessar conteúdo
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span
                className="text-[20px] font-bold"
                style={{ color: "var(--color-blue)", letterSpacing: "-0.5px" }}
              >
                {formatPrice(klip.price)}
              </span>
              <button
                type="button"
                onClick={() => onBuy(klip)}
                className="flex-1 py-2 rounded-xl text-[13px] font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--color-blue)" }}
              >
                Desbloquear
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ canManage }: { canManage: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "var(--color-blue-dim)", border: "1px solid var(--color-blue-border)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
      <p className="font-semibold text-text-1 mb-1">Nenhum conteúdo premium ainda</p>
      <p className="text-sm text-text-3 max-w-xs">
        {canManage
          ? 'Use o botão "⭐ Premium" em uma mensagem do feed para publicar conteúdo exclusivo.'
          : "Em breve haverá conteúdo exclusivo disponível nesta comunidade."}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PremiumPageClient({
  communityId,
  communityName,
  initialKlips,
  initialPurchasedIds,
  canManage,
}: PremiumPageClientProps) {
  const [klips, setKlips] = useState<PremiumKlip[]>(initialKlips as PremiumKlip[]);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set(initialPurchasedIds));
  const [buyTarget, setBuyTarget] = useState<PremiumKlip | null>(null);
  const [viewTarget, setViewTarget] = useState<PremiumKlip | null>(null);

  const handlePurchaseSuccess = useCallback((klipId: string) => {
    setPurchasedIds((prev) => new Set([...prev, klipId]));
    setKlips((prev) =>
      prev.map((k) => (k.id === klipId ? { ...k, purchaseCount: k.purchaseCount + 1 } : k))
    );
    setBuyTarget(null);
  }, []);

  void communityId; // used by parent for API calls — kept for future use

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-bg-page">
      <div className="max-w-4xl mx-auto w-full px-4 py-4 md:px-8 md:py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-[10px] mb-[6px]">
            <span style={{ fontSize: 22 }}>⭐</span>
            <h1
              className="text-[26px] font-bold text-text-1"
              style={{ letterSpacing: "-0.5px" }}
            >
              Área Premium
            </h1>
          </div>
          <p className="text-[14px] text-text-3">
            {communityName} · Conteúdo exclusivo — acesso vitalício por klip
          </p>
        </div>

        {/* Grid */}
        {klips.length === 0 ? (
          <EmptyState canManage={canManage} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {klips.map((klip) => (
              <PremiumCard
                key={klip.id}
                klip={klip}
                owned={purchasedIds.has(klip.id)}
                onBuy={setBuyTarget}
                onView={setViewTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Purchase modal */}
      {buyTarget && (
        <PurchaseModal
          klip={buyTarget}
          onClose={() => setBuyTarget(null)}
          onSuccess={handlePurchaseSuccess}
        />
      )}

      {/* Access modal */}
      {viewTarget && (
        <AccessModal
          klip={viewTarget}
          onClose={() => setViewTarget(null)}
        />
      )}
    </div>
  );
}

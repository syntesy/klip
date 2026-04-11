"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedItem {
  id: string;
  messageId: string;
  savedAt: string;
  message: {
    content: string;
    authorClerkId: string;
    authorName: string;
    topicId: string;
    topicTitle: string;
    communityId: string;
    communityName: string;
    sentAt: string;
  };
}

interface SavedLibraryProps {
  canSave: boolean;
  initialItems: SavedItem[];
  initialNextCursor: string | null;
  initialTotal: number;
}

// ─── Paywall ──────────────────────────────────────────────────────────────────

function LibraryPaywall() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center gap-4 py-20">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(74,158,255,.12)", border: "1px solid rgba(74,158,255,.2)" }}
      >
        <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="#4A9EFF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3-6 3V3a1 1 0 0 1 1-1z" />
        </svg>
      </div>
      <div>
        <p className="text-[15px] font-semibold text-text-1">Biblioteca Pessoal</p>
        <p className="text-[13px] text-text-3 mt-1 max-w-xs">
          Salve mensagens importantes para consultar a qualquer momento. Disponível no plano Pro.
        </p>
      </div>
      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 rounded-[8px] px-5 py-2 text-[13px] font-semibold text-white"
        style={{ background: "#4A9EFF" }}
      >
        Fazer upgrade para Pro
      </Link>
    </div>
  );
}

// ─── SavedItemCard ─────────────────────────────────────────────────────────────

function SavedItemCard({
  item,
  onRemove,
}: {
  item: SavedItem;
  onRemove: (id: string, messageId: string) => void;
}) {
  const sentDate = format(new Date(item.message.sentAt), "d 'de' MMM, HH:mm", { locale: ptBR });

  return (
    <div
      className="bg-bg-surface rounded-xl border border-border p-4 flex flex-col gap-2"
      style={{ borderLeft: "3px solid #4A9EFF" }}
    >
      {/* Header: community > topic */}
      <div className="flex items-center gap-1 text-[11px] text-text-3">
        <span>{item.message.communityName}</span>
        <span>›</span>
        <span className="text-text-2 font-medium">{item.message.topicTitle}</span>
      </div>

      {/* Content */}
      <p className="text-[13.5px] text-text-2 leading-[1.6]">{item.message.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-3">{item.message.authorName}</span>
          <span className="text-[10px] text-text-3">·</span>
          <span className="text-[11px] text-text-3">{sentDate}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/communities/${item.message.communityId}/topics/${item.message.topicId}#msg-${item.messageId}`}
            className="text-[11px] text-blue hover:underline"
          >
            Ver no tópico →
          </Link>
          <button
            type="button"
            onClick={() => onRemove(item.id, item.messageId)}
            className="text-[11px] text-text-3 hover:text-red-400 transition-colors"
            title="Remover da biblioteca"
          >
            Remover
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SavedLibrary ─────────────────────────────────────────────────────────────

export function SavedLibrary({ canSave, initialItems, initialNextCursor, initialTotal }: SavedLibraryProps) {
  const { getToken } = useAuth();
  const [items, setItems] = useState<SavedItem[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${API_URL}/api/me/saved-messages?cursor=${encodeURIComponent(nextCursor)}&limit=20`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) return;
      const data = await res.json() as { items: SavedItem[]; nextCursor: string | null; total: number };
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setTotal(data.total);
    } catch {
      // non-fatal
    } finally {
      setIsLoading(false);
    }
  }, [nextCursor, isLoading, getToken]);

  const handleRemove = useCallback(async (id: string, messageId: string) => {
    // Optimistic remove
    setItems((prev) => prev.filter((i) => i.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));

    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/messages/${messageId}/save`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // non-fatal — the item is already gone from the list
    }
  }, [getToken]);

  if (!canSave) return <LibraryPaywall />;

  return (
    <div className="flex flex-col h-full p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-1">Biblioteca Pessoal</h1>
        <p className="text-text-2 mt-1">
          {total === 0 ? "Nenhuma mensagem salva ainda" : `${total} mensagem${total !== 1 ? "s" : ""} salva${total !== 1 ? "s" : ""}`}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center gap-4 py-20">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(74,158,255,.08)", border: "1px solid rgba(74,158,255,.15)" }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#4A9EFF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3-6 3V3a1 1 0 0 1 1-1z" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold text-text-2">Nenhuma mensagem salva</p>
            <p className="text-[13px] text-text-3 mt-1">
              Salve mensagens clicando no ícone de bookmark em qualquer mensagem
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-2xl">
          {items.map((item) => (
            <SavedItemCard key={item.id} item={item} onRemove={handleRemove} />
          ))}

          {nextCursor && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={isLoading}
              className="text-[13px] text-blue hover:underline text-center py-3 disabled:opacity-50"
            >
              {isLoading ? "Carregando…" : "Carregar mais"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

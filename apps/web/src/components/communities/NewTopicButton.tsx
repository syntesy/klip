"use client";

import { useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Shared modal (used by both NewTopicButton and TopicHeader) ───────────────

interface NewTopicModalProps {
  communityId: string;
  onClose: () => void;
}

export function NewTopicModal({ communityId, onClose }: NewTopicModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const router = useRouter();
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const title = titleRef.current?.value.trim() ?? "";
    const description = descRef.current?.value.trim() || undefined;
    if (!title) return;

    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/topics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ communityId, title, description }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? "Erro ao criar tópico");
        return;
      }

      const topic = await res.json() as { id: string };
      onClose();
      router.push(`/communities/${communityId}/topics/${topic.id}`);
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-bg-surface rounded-2xl border border-border shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-text-1">Novo tópico</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-3 hover:text-text-2 text-lg leading-none"
          >
            ×
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div>
            <label className="text-[12px] text-text-2 mb-1 block">Título</label>
            <input
              ref={titleRef}
              type="text"
              required
              minLength={2}
              maxLength={200}
              autoFocus
              placeholder="Ex: Estratégia de lançamento"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-page text-[13px] text-text-1 outline-none focus:border-blue transition-colors"
            />
          </div>
          <div>
            <label className="text-[12px] text-text-2 mb-1 block">Descrição (opcional)</label>
            <input
              ref={descRef}
              type="text"
              maxLength={1000}
              placeholder="Do que se trata este tópico?"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-page text-[13px] text-text-1 outline-none focus:border-blue transition-colors"
            />
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-[13px] text-text-2 hover:bg-bg-subtle transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg text-white text-[13px] font-medium transition-colors disabled:opacity-60"
              style={{ background: "#22C98A" }}
            >
              {loading ? "Criando…" : "Criar tópico"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Standalone button (used on community page) ───────────────────────────────

interface Props {
  communityId: string;
}

export function NewTopicButton({ communityId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-white rounded-lg font-medium transition-colors text-sm"
        style={{ background: "#22C98A" }}
      >
        + Novo tópico
      </button>

      {open && (
        <NewTopicModal communityId={communityId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

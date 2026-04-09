"use client";

import { useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function NewCommunityButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = nameRef.current?.value.trim() ?? "";
    const slug = slugRef.current?.value.trim() ?? "";
    const description = descRef.current?.value.trim() || undefined;

    if (!name || !slug) return;

    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/communities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name, slug, description }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; detail?: string };
        setError(body.detail ?? body.error ?? "Erro ao criar comunidade");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  function autoSlug(name: string) {
    if (slugRef.current) {
      slugRef.current.value = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-blue text-white rounded-lg font-medium hover:bg-blue/90 transition-colors text-sm"
      >
        + Nova comunidade
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-bg-surface rounded-2xl border border-border shadow-lg w-full max-w-md p-6">
            <h2 className="text-[15px] font-semibold text-text-1 mb-4">Nova comunidade</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[12px] text-text-2 mb-1 block">Nome</label>
                <input
                  ref={nameRef}
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Ex: Produto & Design"
                  onChange={(e) => autoSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-page text-[13px] text-text-1 outline-none focus:border-blue transition-colors"
                />
              </div>
              <div>
                <label className="text-[12px] text-text-2 mb-1 block">Slug</label>
                <input
                  ref={slugRef}
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  pattern="[a-z0-9-]+"
                  placeholder="produto-design"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-page text-[13px] text-text-1 font-mono outline-none focus:border-blue transition-colors"
                />
              </div>
              <div>
                <label className="text-[12px] text-text-2 mb-1 block">Descrição (opcional)</label>
                <input
                  ref={descRef}
                  type="text"
                  maxLength={500}
                  placeholder="Breve descrição da comunidade"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-page text-[13px] text-text-1 outline-none focus:border-blue transition-colors"
                />
              </div>

              {error && (
                <p className="text-[12px] text-red-500">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border text-[13px] text-text-2 hover:bg-bg-subtle transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue text-white text-[13px] font-medium hover:bg-blue/90 transition-colors disabled:opacity-60"
                >
                  {loading ? "Criando…" : "Criar comunidade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

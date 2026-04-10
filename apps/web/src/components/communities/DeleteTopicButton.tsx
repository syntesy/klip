"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Trash2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function DeleteTopicButton({ topicId, communityId, topicTitle }: { topicId: string; communityId: string; topicTitle: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { getToken } = useAuth();
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    const token = await getToken();
    await fetch(`${API_URL}/api/topics/${topicId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setOpen(false);
    router.push(`/communities/${communityId}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] text-red-500 border border-red-500/30 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 size={13} strokeWidth={1.75} />
        Excluir tópico
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="bg-bg-surface rounded-2xl border border-border shadow-lg w-full max-w-sm p-6">
            <h2 className="text-[15px] font-semibold text-text-1 mb-2">Excluir tópico</h2>
            <p className="text-[13px] text-text-2 mb-5">
              Tem certeza que deseja excluir <strong>{topicTitle}</strong>? Todas as mensagens serão perdidas.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-[13px] text-text-2 hover:bg-bg-subtle transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white text-[13px] font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {loading ? "Excluindo…" : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Confirmation dialog for deleting a topic.
 * Controlled — no trigger button included.
 * Usage: render with open=true from a ⋮ menu or bottom sheet.
 */
export function DeleteTopicConfirmDialog({
  open,
  onClose,
  topicId,
  communityId,
  topicTitle,
}: {
  open: boolean;
  onClose: () => void;
  topicId: string;
  communityId: string;
  topicTitle: string;
}) {
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
    onClose();
    router.push(`/communities/${communityId}`);
    router.refresh();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-bg-surface rounded-2xl border border-border shadow-lg w-full max-w-sm p-6">
        <h2 className="text-[15px] font-semibold text-text-1 mb-2">Excluir tópico</h2>
        <p className="text-[13px] text-text-2 mb-5">
          Tem certeza que deseja excluir <strong>{topicTitle}</strong>? Todas as mensagens serão perdidas.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
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
  );
}

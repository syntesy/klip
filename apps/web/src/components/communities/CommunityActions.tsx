"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { NewTopicModal } from "@/components/communities/NewTopicButton";
import { InviteButton } from "@/components/communities/InviteButton";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Props {
  communityId: string;
  communityName: string;
}

export function CommunityActions({ communityId, communityName }: Props) {
  const [topicOpen, setTopicOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { getToken } = useAuth();
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/communities/${communityId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      router.push("/communities");
      router.refresh();
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  const secondaryStyle: React.CSSProperties = {
    background: "var(--color-bg-subtle)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    color: "var(--color-text-1)",
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        {/* Novo tópico — primário */}
        <button
          type="button"
          onClick={() => setTopicOpen(true)}
          style={{
            flex: 1,
            background: "#4A9EFF",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + Novo tópico
        </button>

        {/* Convidar — secundário */}
        <InviteButton communityId={communityId} triggerStyle={secondaryStyle} />

        {/* ··· menu */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Mais opções"
            style={{
              width: 38,
              height: "100%",
              minHeight: 40,
              background: "var(--color-bg-subtle)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              color: "var(--color-text-2)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              letterSpacing: 2,
            }}
          >
            ···
          </button>

          {menuOpen && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 90 }}
                onClick={() => setMenuOpen(false)}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  zIndex: 100,
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  padding: 4,
                  minWidth: 190,
                  boxShadow: "0 8px 24px rgba(0,0,0,.25)",
                }}
              >
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    padding: "8px 12px",
                    fontSize: 13,
                    cursor: "pointer",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <polyline points="3 6 13 6" strokeLinecap="round" />
                    <path d="M5 6V4a1 1 0 011-1h4a1 1 0 011 1v2" strokeLinecap="round" />
                    <rect x="2" y="6" width="12" height="9" rx="1" />
                  </svg>
                  Excluir comunidade
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {topicOpen && (
        <NewTopicModal communityId={communityId} onClose={() => setTopicOpen(false)} />
      )}

      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => e.target === e.currentTarget && setDeleteOpen(false)}
        >
          <div className="bg-bg-surface rounded-2xl border border-border shadow-lg w-full max-w-sm p-6">
            <h2 className="text-[15px] font-semibold text-text-1 mb-2">Excluir comunidade</h2>
            <p className="text-[13px] text-text-2 mb-5">
              Tem certeza que deseja excluir <strong>{communityName}</strong>? Esta ação não pode
              ser desfeita e todos os tópicos e mensagens serão perdidos.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-[13px] text-text-2 hover:bg-bg-subtle transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white text-[13px] font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleting ? "Excluindo…" : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, CheckCircle2, Radio, Sparkles, MoreVertical, Trash2 } from "lucide-react";
import { NewTopicModal } from "@/components/communities/NewTopicButton";
import { SummaryCard } from "@/components/communities/SummaryCard";
import { useSummary } from "@/hooks/useSummary";
import { useVoiceSession } from "@/hooks/useVoiceSession";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type UserRole = "owner" | "moderator" | "member";

interface Props {
  communityId: string;
  communityName: string;
  /** When provided, enables summary and voice actions for this specific topic. */
  topicId?: string;
  /** Role of the authenticated user in this community. */
  userRole?: UserRole;
}

export function CommunityActions({ communityId, communityName, topicId, userRole }: Props) {
  const [topicOpen, setTopicOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const { getToken, userId } = useAuth();
  const router = useRouter();

  // ── Summary ────────────────────────────────────────────────────────────────
  const { state: summaryState, summary, errorMessage: summaryError, generate, dismiss } = useSummary(topicId);

  // ── Voice ──────────────────────────────────────────────────────────────────
  const voice = useVoiceSession(topicId ?? "", userId ?? "", getToken);
  const canStartVoice = !!topicId && (userRole === "owner" || userRole === "moderator");

  async function handleVoiceClick() {
    if (!topicId) return;
    setVoiceError(null);

    if (voice.isConnected) {
      try {
        await voice.leaveSession();
      } catch {
        setVoiceError("Falha ao encerrar sessão de voz.");
      }
      return;
    }

    if (!canStartVoice) return;

    try {
      await voice.startSession(communityId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("LIVEKIT") || msg.includes("token") || msg.includes("401") || msg.includes("500")) {
        setVoiceError("Voz indisponível no momento. Tente novamente mais tarde.");
      } else {
        setVoiceError(msg);
      }
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
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

  // ── Voice button label / style ─────────────────────────────────────────────
  const voiceActive = voice.isConnected;
  const voiceDisabled = !topicId || (!canStartVoice && !voiceActive);
  const voiceTitle = !topicId
    ? "Selecione um tópico"
    : !canStartVoice && !voiceActive
    ? "Apenas moderador pode iniciar"
    : voiceActive
    ? `Voz ativa · ${voice.participantCount} participante${voice.participantCount !== 1 ? "s" : ""}`
    : "Iniciar voz";

  return (
    <>
      <div className="flex items-center justify-end gap-1 md:gap-2 shrink-0">
        {/* Marcar decisão — TODO: Sprint B2 */}
        <button
          type="button"
          onClick={() => {/* TODO: Sprint B2 — decision handler */}}
          className="flex items-center gap-[6px] rounded-[10px] border border-border bg-transparent text-text-2 text-[13px] font-medium cursor-pointer whitespace-nowrap p-[7px] md:px-[14px] md:py-[8px] hover:bg-bg-subtle transition-colors"
          title="Marcar decisão"
        >
          <CheckCircle2 size={14} />
          <span className="hidden md:inline">Marcar decisão</span>
        </button>

        {/* Iniciar voz */}
        <button
          type="button"
          onClick={() => void handleVoiceClick()}
          disabled={voiceDisabled}
          title={voiceTitle}
          className="flex items-center gap-[6px] rounded-[10px] border border-border bg-transparent text-[13px] font-medium cursor-pointer whitespace-nowrap p-[7px] md:px-[14px] md:py-[8px] hover:bg-bg-subtle transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={voiceActive ? { color: "#22C98A", borderColor: "#22C98A" } : { color: "var(--color-text-2)" }}
        >
          {voiceActive ? (
            <>
              <span style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#22C98A",
                animation: "pulse 1.5s infinite",
                flexShrink: 0,
              }} />
              <Radio size={14} />
              <span className="hidden md:inline">
                {voice.participantCount} participante{voice.participantCount !== 1 ? "s" : ""}
              </span>
            </>
          ) : (
            <>
              <Radio size={14} />
              <span className="hidden md:inline">Iniciar live</span>
            </>
          )}
        </button>

        {/* Novo tópico */}
        <button
          type="button"
          onClick={() => setTopicOpen(true)}
          className="flex items-center gap-[6px] rounded-[10px] border-0 text-white text-[13px] font-semibold cursor-pointer whitespace-nowrap p-[7px] md:px-[16px] md:py-[8px] transition-colors"
          style={{ background: "#4A9EFF", boxShadow: "0 2px 6px rgba(74,158,255,.25)" }}
          title="Novo tópico"
        >
          <MessageSquarePlus size={14} />
          <span className="hidden md:inline">Novo tópico</span>
        </button>

        {/* ⋮ menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Mais opções"
            className="flex items-center justify-center w-[34px] h-[34px] rounded-[10px] border border-border bg-transparent text-text-3 cursor-pointer hover:bg-bg-subtle transition-colors"
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[90]" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute top-[calc(100%+6px)] right-0 z-[100] bg-bg-surface border border-border rounded-[10px] p-1 min-w-[200px]"
                style={{ boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}
              >
                {/* Gerar resumo */}
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); void generate(); }}
                  disabled={!topicId || summaryState === "loading"}
                  title={!topicId ? "Selecione um tópico" : undefined}
                  className="w-full text-left bg-transparent border-0 text-text-2 py-[8px] px-[12px] text-[13px] cursor-pointer rounded-[6px] flex items-center gap-2 hover:bg-bg-subtle transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles size={14} style={summaryState === "loading" ? { animation: "spin 1s linear infinite" } : undefined} />
                  {summaryState === "loading" ? "Gerando…" : "Gerar resumo"}
                </button>

                <div className="h-px mx-2 my-1" style={{ background: "var(--color-border)" }} />

                {/* Excluir comunidade */}
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                  className="w-full text-left bg-transparent border-0 py-[8px] px-[12px] text-[13px] cursor-pointer rounded-[6px] flex items-center gap-2 hover:bg-bg-subtle transition-colors"
                  style={{ color: "#ef4444" }}
                >
                  <Trash2 size={14} />
                  Excluir comunidade
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary card — aparece abaixo das ações */}
      {(summaryState === "success" || summaryState === "error") && (
        <div style={{ marginTop: 12, width: "100%" }}>
          {summaryState === "success" && summary && (
            <SummaryCard summary={summary} onDismiss={dismiss} />
          )}
          {summaryState === "error" && summaryError && (
            <div style={{
              background: "rgba(239,68,68,.08)",
              border: "1px solid rgba(239,68,68,.3)",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 13,
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span>{summaryError}</span>
              <button
                type="button"
                onClick={dismiss}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}
                aria-label="Fechar"
              >✕</button>
            </div>
          )}
        </div>
      )}

      {/* Voice error toast */}
      {voiceError && (
        <div style={{
          marginTop: 8,
          width: "100%",
          background: "rgba(239,68,68,.08)",
          border: "1px solid rgba(239,68,68,.3)",
          borderRadius: 10,
          padding: "10px 16px",
          fontSize: 13,
          color: "#ef4444",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span>{voiceError}</span>
          <button
            type="button"
            onClick={() => setVoiceError(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}
            aria-label="Fechar"
          >✕</button>
        </div>
      )}

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

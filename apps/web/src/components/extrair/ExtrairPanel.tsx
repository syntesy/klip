"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import type { Message } from "@/components/chat/MessageFeed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentIdea {
  type: "checklist" | "faq" | "insight" | "continuacao";
  title: string;
  description: string;
}

interface ExtrairResult {
  id: string;
  summary: string;
  titleOptions: [string, string, string];
  contentIdeas: ContentIdea[];
}

export interface ExtrairPanelProps {
  topicId: string;
  communityId: string;
  topicTitle: string;
  selectedMessages: Message[];
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IDEA_TYPE_LABEL: Record<ContentIdea["type"], string> = {
  checklist:   "✅ Checklist",
  faq:         "❓ FAQ",
  insight:     "💡 Insight",
  continuacao: "➡️ Continuação",
};

const IDEA_TYPE_COLOR: Record<ContentIdea["type"], string> = {
  checklist:   "var(--color-green)",
  faq:         "var(--color-amber)",
  insight:     "var(--color-blue-bright)",
  continuacao: "var(--color-text-2)",
};

// ─── ExtrairPanel ─────────────────────────────────────────────────────────────

export function ExtrairPanel({
  topicId,
  communityId,
  topicTitle,
  selectedMessages,
  onClose,
}: ExtrairPanelProps) {
  const { getToken } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<"preview" | "processing" | "result" | "publishing" | "done">("preview");
  const [result, setResult] = useState<ExtrairResult | null>(null);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [editedSummary, setEditedSummary] = useState("");
  const [accessLevel, setAccessLevel] = useState<"free" | "premium">("premium");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  // ── Step 1: Process with AI ──────────────────────────────────────────────

  const handleProcess = useCallback(async () => {
    setStep("processing");
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/extrair`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topicId,
          communityId,
          messageIds: selectedMessages.map((m) => m.id),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? "Erro ao processar com IA");
        setStep("preview");
        return;
      }

      const data = await res.json() as ExtrairResult;
      setResult(data);
      setSelectedTitle(data.titleOptions[0]);
      setEditedSummary(data.summary);
      setStep("result");
    } catch {
      setError("Erro de rede");
      setStep("preview");
    }
  }, [topicId, communityId, selectedMessages, getToken]);

  // ── Step 2: Publish ──────────────────────────────────────────────────────

  const handlePublish = useCallback(async () => {
    if (!result) return;
    setStep("publishing");
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/extrair/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          extractedContentId: result.id,
          title: selectedTitle || result.titleOptions[0],
          summary: editedSummary,
          accessLevel,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? "Erro ao publicar");
        setStep("result");
        return;
      }

      setStep("done");
      setToast(true);
      setTimeout(() => {
        onClose();
        router.push(`/communities/${communityId}/biblioteca`);
      }, 2000);
    } catch {
      setError("Erro de rede");
      setStep("result");
    }
  }, [result, selectedTitle, editedSummary, accessLevel, communityId, getToken, onClose, router]);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden"
        style={{
          width: 380,
          background: "var(--color-bg-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-4px 0 24px rgba(0,0,0,.12)",
        }}
        aria-label="Painel de extração"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-[8px]">
            <span style={{ color: "var(--color-blue-bright)", fontSize: 16 }}>✦</span>
            <span className="text-[14px] font-bold text-text-1" style={{ letterSpacing: "-0.2px" }}>
              Extrair conteúdo
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-3 hover:text-text-2 text-[18px] leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 flex flex-col gap-5">

          {/* ── Seção 1: Preview das mensagens ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-3 mb-[8px]">
              {selectedMessages.length} mensagem{selectedMessages.length !== 1 ? "s" : ""} selecionada{selectedMessages.length !== 1 ? "s" : ""}
            </p>
            <div
              className="flex flex-col gap-[6px] rounded-[10px] p-[10px]"
              style={{ background: "var(--color-bg-subtle)", maxHeight: 200, overflowY: "auto" }}
            >
              {selectedMessages.map((msg) => (
                <div key={msg.id} className="flex gap-[8px]">
                  <span className="text-[11px] font-semibold text-text-3 shrink-0">
                    {msg.author.name.split(" ")[0]}:
                  </span>
                  <span className="text-[11px] text-text-2 leading-[1.5] truncate">
                    {msg.content.slice(0, 80)}{msg.content.length > 80 ? "…" : ""}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-text-3 mt-[6px]">
              Tópico: <strong>{topicTitle}</strong>
            </p>
          </div>

          {/* ── Seção 2: Botão processar ── */}
          {(step === "preview" || step === "processing") && (
            <div>
              {error && (
                <p className="text-[12px] text-red-500 mb-3">{error}</p>
              )}
              <button
                type="button"
                onClick={() => void handleProcess()}
                disabled={step === "processing"}
                className="w-full py-[12px] rounded-[10px] text-[13px] font-semibold transition-all flex items-center justify-center gap-[8px]"
                style={{
                  background: step === "processing" ? "var(--color-bg-muted)" : "var(--color-blue)",
                  color: step === "processing" ? "var(--color-text-3)" : "#fff",
                }}
              >
                {step === "processing" ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    Processando… ~3 segundos
                  </>
                ) : (
                  <>
                    <span>✦</span>
                    Processar com IA
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── Seção 3: Resultado da IA ── */}
          {(step === "result" || step === "publishing") && result && (
            <>
              {/* Título */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-3 mb-[8px]">
                  Título
                </p>
                <div className="flex flex-col gap-[5px] mb-[8px]">
                  {result.titleOptions.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedTitle(opt)}
                      className="text-left px-[12px] py-[8px] rounded-[8px] text-[12.5px] transition-all"
                      style={{
                        background: selectedTitle === opt ? "var(--color-blue-dim)" : "var(--color-bg-subtle)",
                        border: selectedTitle === opt
                          ? "1px solid var(--color-blue-border)"
                          : "1px solid var(--color-border)",
                        color: selectedTitle === opt ? "var(--color-blue)" : "var(--color-text-2)",
                        fontWeight: selectedTitle === opt ? 600 : 400,
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={selectedTitle}
                  onChange={(e) => setSelectedTitle(e.target.value)}
                  placeholder="Ou escreva um título personalizado…"
                  className="w-full px-[12px] py-[8px] rounded-[8px] text-[12.5px] text-text-1 outline-none transition-colors"
                  style={{
                    background: "var(--color-input-bg)",
                    border: "1.5px solid var(--color-input-border)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-input-border-focus)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-input-border)")}
                />
              </div>

              {/* Resumo */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-3 mb-[8px]">
                  Resumo
                </p>
                <textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  rows={4}
                  className="w-full px-[12px] py-[8px] rounded-[8px] text-[12.5px] text-text-1 outline-none resize-none transition-colors"
                  style={{
                    background: "var(--color-input-bg)",
                    border: "1.5px solid var(--color-input-border)",
                    lineHeight: "1.6",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-input-border-focus)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-input-border)")}
                />
              </div>

              {/* Ideias de conteúdo */}
              {result.contentIdeas.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-3 mb-[8px]">
                    Ideias de conteúdo
                  </p>
                  <div className="flex flex-col gap-[6px]">
                    {result.contentIdeas.map((idea, i) => (
                      <div
                        key={i}
                        className="rounded-[8px] px-[12px] py-[10px]"
                        style={{
                          background: "var(--color-bg-subtle)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <div className="flex items-center gap-[6px] mb-[3px]">
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: IDEA_TYPE_COLOR[idea.type] }}
                          >
                            {IDEA_TYPE_LABEL[idea.type]}
                          </span>
                        </div>
                        <p className="text-[12px] font-semibold text-text-1 mb-[2px]">{idea.title}</p>
                        <p className="text-[11px] text-text-3 leading-[1.4]">{idea.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Seção 4: Nível de acesso ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-3 mb-[8px]">
                  Nível de acesso
                </p>
                <div
                  className="flex rounded-[8px] overflow-hidden"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  {(["free", "premium"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setAccessLevel(level)}
                      className="flex-1 py-[8px] text-[12px] font-semibold transition-all"
                      style={{
                        background: accessLevel === level
                          ? level === "premium" ? "var(--color-blue)" : "var(--color-green-dim)"
                          : "transparent",
                        color: accessLevel === level
                          ? level === "premium" ? "#fff" : "var(--color-green)"
                          : "var(--color-text-3)",
                      }}
                    >
                      {level === "free" ? "Gratuito" : "✦ Premium"}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-text-3 mt-[5px]">
                  {accessLevel === "premium"
                    ? "Apenas membros premium verão o conteúdo completo. Um card de convite será exibido para os demais."
                    : "Todos os membros terão acesso completo a este conteúdo."}
                </p>
              </div>

              {error && (
                <p className="text-[12px] text-red-500">{error}</p>
              )}
            </>
          )}
        </div>

        {/* ── Seção 5: Botão Publicar ── */}
        {(step === "result" || step === "publishing") && (
          <div
            className="px-5 py-4 shrink-0"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={step === "publishing" || !selectedTitle.trim()}
              className="w-full py-[12px] rounded-[10px] text-[13px] font-semibold transition-all flex items-center justify-center gap-[8px]"
              style={{
                background: step === "publishing" ? "var(--color-bg-muted)" : "var(--color-blue)",
                color: step === "publishing" ? "var(--color-text-3)" : "#fff",
                opacity: !selectedTitle.trim() ? 0.5 : 1,
              }}
            >
              {step === "publishing" ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  Publicando…
                </>
              ) : (
                <>✦ Publicar na Biblioteca</>
              )}
            </button>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            className="absolute bottom-6 left-5 right-5 py-[12px] px-[16px] rounded-[10px] text-[13px] font-semibold text-white flex items-center gap-[8px]"
            style={{ background: "var(--color-green)", boxShadow: "0 4px 16px rgba(0,0,0,.2)" }}
          >
            <span>✓</span>
            Conteúdo publicado na Biblioteca ✦
          </div>
        )}
      </aside>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { MessageSquarePlus, CheckCircle2, Radio, Sparkles, MoreVertical } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopicMeta {
  id: string;
  title: string;
  communityName?: string;
  messageCount: number;
  participantCount: number;
  status: "active" | "resolved" | "closed";
  pinnedMessageId?: string | null;
  pinnedMessageContent?: string | null;
  pinnedMessageAuthor?: string | null;
}

export interface PinnedMessage {
  messageId: string;
  content: string;
  authorName: string;
}

export interface TopicHeaderProps {
  topic: TopicMeta;
  isConnected?: boolean;
  onRequestSummary?: () => void;
  onMarkDecision?: () => void;
  onNewTopic?: () => void;
  pinnedMessage?: PinnedMessage | null;
  onUnpin?: () => void;
  onScrollToPin?: () => void;
  // Search
  isSearchOpen?: boolean;
  searchQuery?: string;
  onSearchOpen?: () => void;
  onSearchClose?: () => void;
  onSearchChange?: (q: string) => void;
  // Voice
  isHost?: boolean;
  communityId?: string;
  userId?: string;
  userName?: string;
  activeVoiceSession?: boolean;
  onStartVoice?: () => void;
  onEndVoice?: () => void;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="M10 10l3.5 3.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
    </svg>
  );
}

// ─── TopicHeader ──────────────────────────────────────────────────────────────

export function TopicHeader({
  isHost = false,
  activeVoiceSession = false,
  onStartVoice,
  onEndVoice,
  topic,
  isConnected,
  onRequestSummary,
  onMarkDecision,
  onNewTopic,
  pinnedMessage,
  onUnpin,
  onScrollToPin,
  isSearchOpen = false,
  searchQuery = "",
  onSearchOpen,
  onSearchClose,
  onSearchChange,
}: TopicHeaderProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  return (
    <div className="flex flex-col shrink-0">
    <header
      className="h-[60px] bg-bg-surface border-b border-border flex items-center px-3 md:px-5 gap-2 md:gap-3 shrink-0"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}
      aria-label="Cabeçalho do tópico"
    >
      {/* Back button — hidden during search */}
      {!isSearchOpen && (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
          className="flex items-center justify-center w-[30px] h-[30px] min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-[6px] text-text-3 border border-border bg-bg-subtle hover:bg-bg-muted hover:text-text-2 transition-colors shrink-0"
        >
          <ChevronLeft />
        </button>
      )}

      {/* Search input — shown when open */}
      {isSearchOpen ? (
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-[8px] rounded-[8px] border border-border bg-bg-subtle px-[10px] py-[6px]"
            style={{ borderColor: "var(--color-blue)", boxShadow: "0 0 0 3px rgba(74,158,255,.12)" }}>
            <SearchIcon />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") onSearchClose?.(); }}
              placeholder="Buscar mensagens neste tópico…"
              className="flex-1 bg-transparent text-[13px] text-text-1 placeholder:text-text-3 outline-none"
            />
            {searchQuery && (
              <button type="button" onClick={() => onSearchChange?.("")}
                className="text-text-3 hover:text-text-2 transition-colors text-[16px] leading-none">
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onSearchClose}
            className="flex items-center justify-center w-[30px] h-[30px] rounded-[6px] text-text-3 border border-border bg-bg-subtle hover:bg-bg-muted hover:text-text-2 transition-colors shrink-0"
            title="Fechar busca (Esc)"
          >
            <CloseIcon />
          </button>
        </div>
      ) : (
        <>
          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <h1
              className="text-[16px] text-text-1 truncate leading-none"
              style={{ fontWeight: 700, letterSpacing: "-0.4px" }}
            >
              {topic.title}
            </h1>
            <div className="flex items-center gap-[6px] mt-[3px]" style={{ fontSize: 11, color: "var(--color-text-3)" }}>
              <span className="relative flex w-[6px] h-[6px] shrink-0">
                {isConnected !== false && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-60" />
                )}
                <span
                  className="relative inline-flex rounded-full w-[6px] h-[6px]"
                  style={{ background: isConnected === false ? "var(--color-text-3)" : "var(--color-green)" }}
                />
              </span>
              {topic.communityName && <span>{topic.communityName}</span>}
              {topic.communityName && <span style={{ color: "var(--color-border-mid)" }}>·</span>}
              <span>{topic.messageCount} mensagens</span>
              <span style={{ color: "var(--color-border-mid)" }}>·</span>
              <span>{topic.participantCount} participantes</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-[4px] shrink-0">
            {/* Icon-only ghost buttons */}
            <button
              type="button"
              onClick={onSearchOpen}
              className="flex items-center justify-center w-[30px] h-[30px] rounded-[6px] text-text-3 bg-transparent border-0 hover:bg-bg-subtle hover:text-text-1 transition-colors"
              title="Buscar mensagens"
            >
              <SearchIcon />
            </button>

            {/* Text ghost buttons — secondary actions */}
            <button
              type="button"
              onClick={onMarkDecision}
              className="hidden md:flex items-center gap-[5px] text-[12px] font-medium text-text-3 px-[10px] py-[6px] rounded-[6px] bg-transparent border-0 hover:bg-bg-subtle hover:text-text-1 transition-colors leading-none"
            >
              <CheckCircle2 size={12} />
              Marcar decisão
            </button>
            <button
              type="button"
              onClick={onRequestSummary}
              className="hidden md:flex items-center gap-[5px] text-[12px] font-medium text-text-3 px-[10px] py-[6px] rounded-[6px] bg-transparent border-0 hover:bg-bg-subtle hover:text-text-1 transition-colors leading-none"
            >
              <Sparkles size={12} />
              Gerar resumo
            </button>

            {/* Mobile overflow menu for hidden actions */}
            <div className="relative md:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Mais ações"
                className="flex items-center justify-center w-[30px] h-[30px] rounded-[6px] text-text-3 bg-transparent border-0 hover:bg-bg-subtle hover:text-text-1 transition-colors"
              >
                <MoreVertical size={14} />
              </button>
              {mobileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[90]" onClick={() => setMobileMenuOpen(false)} />
                  <div
                    className="absolute top-[calc(100%+4px)] right-0 z-[100] bg-bg-surface border border-border rounded-[10px] p-1 min-w-[180px]"
                    style={{ boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}
                  >
                    <button
                      type="button"
                      onClick={() => { setMobileMenuOpen(false); onMarkDecision?.(); }}
                      className="w-full text-left bg-transparent border-0 text-text-2 py-[8px] px-[12px] text-[13px] cursor-pointer rounded-[6px] flex items-center gap-2 hover:bg-bg-subtle transition-colors"
                    >
                      <CheckCircle2 size={13} />
                      Marcar decisão
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMobileMenuOpen(false); onRequestSummary?.(); }}
                      className="w-full text-left bg-transparent border-0 text-text-2 py-[8px] px-[12px] text-[13px] cursor-pointer rounded-[6px] flex items-center gap-2 hover:bg-bg-subtle transition-colors"
                    >
                      <Sparkles size={13} />
                      Gerar resumo
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* CTA primário — icon-only on mobile, text on md+ */}
            <button
              type="button"
              onClick={onNewTopic}
              className="flex items-center gap-[5px] text-[12px] font-semibold text-white px-[10px] md:px-[14px] py-[6px] rounded-[6px] border-0 transition-all leading-none"
              style={{ background: "#4A9EFF", boxShadow: "0 2px 6px rgba(74,158,255,.3)" }}
              title="Novo tópico"
            >
              <MessageSquarePlus size={12} />
              <span className="hidden md:inline">Novo tópico</span>
            </button>

            {/* Botão de voz — icon-only on mobile */}
            {isHost && (
              <button
                type="button"
                onClick={activeVoiceSession ? onEndVoice : onStartVoice}
                className="flex items-center gap-[5px] text-[12px] font-medium px-[10px] py-[6px] rounded-[6px] transition-colors leading-none border"
                title={activeVoiceSession ? "Encerrar áudio" : "Iniciar áudio ao vivo"}
                style={activeVoiceSession ? {
                  background: "var(--color-danger-dim)",
                  borderColor: "var(--color-danger-border)",
                  color: "#ef4444",
                } : {
                  background: "var(--color-bg-subtle)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-2)",
                }}
              >
                <Radio size={12} />
                <span className="hidden md:inline">{activeVoiceSession ? ' Encerrar' : ' Iniciar live'}</span>
              </button>
            )}
          </div>
        </>
      )}
    </header>

    {/* ── Pinned message banner ──────────────────────────────────────── */}
    {pinnedMessage && (
      <div
        className="flex items-center gap-[8px] px-5 py-[7px] text-[12px] cursor-pointer"
        style={{
          background: "var(--color-green-dim)",
          borderBottom: "1px solid var(--color-green-border)",
        }}
        onClick={onScrollToPin}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--color-green)", flexShrink: 0 }}>
          <path d="M9 2l5 5-6 6-1-3-4 4-1-1 4-4-3-1z" />
          <path d="M2 14l3-3" strokeLinecap="round" />
        </svg>
        <span className="shrink-0 font-medium" style={{ color: "var(--color-green)" }}>
          {pinnedMessage.authorName}:
        </span>
        <span className="text-text-2 truncate flex-1">
          {pinnedMessage.content.length > 80
            ? pinnedMessage.content.slice(0, 80) + "…"
            : pinnedMessage.content}
        </span>
        {isHost && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUnpin?.(); }}
            className="shrink-0 text-text-3 hover:text-text-1 transition-colors text-[16px] leading-none ml-1"
            title="Desafixar"
          >
            ×
          </button>
        )}
      </div>
    )}
    </div>
  );
}

"use client";

import { isToday, isYesterday, format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useAuth } from "@clerk/nextjs";
import type { Attachment } from "@/hooks/useTopicSocket";
import { AttachmentImage } from "@/components/chat/AttachmentImage";
import { AudioPlayer } from "@/components/chat/AudioPlayer";
import { SaveButton } from "@/components/chat/SaveButton";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MessageAuthor {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface Message {
  id: string;
  topicId: string;
  authorId: string;
  content: string;
  isEdited: boolean;
  isKlipped?: boolean;
  attachments?: Attachment[];
  reactions?: Reaction[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  author: MessageAuthor;
  replyToId?: string | null;
  replyToAuthorName?: string | null;
  replyToContent?: string | null;
  savedByCurrentUser?: boolean;
}

export interface TypingUser {
  userId: string;
  name: string;
}

interface TopicSummary {
  content: string;
  decisions: string[];
  generatedAt: Date;
}

export interface MessageFeedProps {
  messages: Message[];
  currentUserId: string;
  topicSummary?: TopicSummary | null;
  typingUsers?: TypingUser[];
  onKlipMessage?: (messageId: string) => void;
  onReply?: (message: Message) => void;
  onPin?: (message: Message) => void;
  /** Whether the current user is an admin (owner/moderator) — gates Klipar */
  isAdmin?: boolean;
  /** Whether the current user can save messages (Pro/Business plan) */
  canSave?: boolean;
  highlightedMessageId?: string | null;
  /** @klip is processing a command */
  klipThinking?: boolean;
  /** Private /klip response to show inline (not persisted) */
  privateKlipResponse?: string | null;
  onClearPrivateResponse?: () => void;
}

// ─── Internal grouping types ──────────────────────────────────────────────────

interface MessageGroup {
  authorId: string;
  author: MessageAuthor;
  messages: Message[];
}

interface DateGroup {
  dateKey: string;          // "yyyy-MM-dd" for stable key
  dateLabel: string;        // "hoje" | "ontem" | "14 abr"
  representativeDate: Date;
  groups: MessageGroup[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateDivider(date: Date): string {
  if (isToday(date)) return "hoje";
  if (isYesterday(date)) return "ontem";
  return format(date, "d MMM", { locale: ptBR });
}

function formatTimeAgo(date: Date): string {
  const mins = differenceInMinutes(new Date(), date);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return format(date, "d MMM", { locale: ptBR });
}

function formatTimestamp(date: Date): string {
  return format(date, "HH:mm");
}

// Paleta de gradientes para avatares — 8 variações diagonais
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #4A9EFF, #1249A0)",
  "linear-gradient(135deg, #22C98A, #117a53)",
  "linear-gradient(135deg, #F5A94A, #c47b1a)",
  "linear-gradient(135deg, #60a5fa, #2563eb)",
  "linear-gradient(135deg, #a78bfa, #6d28d9)",
  "linear-gradient(135deg, #f472b6, #be185d)",
  "linear-gradient(135deg, #34d399, #065f46)",
  "linear-gradient(135deg, #fb923c, #9a3412)",
];

function getAvatarStyle(userId: string, _isDark = false): { background: string; color: string } {
  const idx = parseInt(userId.replace(/-/g, "").slice(0, 8), 16) % AVATAR_GRADIENTS.length;
  return {
    background: AVATAR_GRADIENTS[idx]!,
    color: "#fff",
  };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function getTypingText(users: TypingUser[]): string {
  if (users.length === 0) return "";
  if (users.length === 1) return `${users[0]!.name} está digitando…`;
  if (users.length === 2)
    return `${users[0]!.name} e ${users[1]!.name} estão digitando…`;
  return `${users[0]!.name} e mais ${users.length - 1} estão digitando…`;
}

// ─── Shared reaction toggle ───────────────────────────────────────────────────

/**
 * Computes the next optimistic reactions state for a toggle action.
 * Shared by ReactionBubbles and MessageHoverBar to avoid duplicate logic.
 */
function computeNextReactions(reactions: Reaction[], emoji: string): { next: Reaction[]; method: "POST" | "DELETE" } {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (!existing) {
    return { next: [...reactions, { emoji, count: 1, reactedByMe: true }], method: "POST" };
  }
  if (existing.reactedByMe) {
    const next = existing.count > 1
      ? reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r)
      : reactions.filter((r) => r.emoji !== emoji);
    return { next, method: "DELETE" };
  }
  return { next: reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r), method: "POST" };
}

/** Inline markdown → React nodes. Handles **bold**, *italic*, and @mentions. */
function parseInline(text: string): React.ReactNode[] {
  // Split on bold, italic, and @mentions
  const parts = text.split(/(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|@[\w.-]+)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (/^@[\w.-]+$/.test(part)) {
      return (
        <span
          key={i}
          style={{
            color: "#4A9EFF",
            background: "rgba(74,158,255,.1)",
            borderRadius: 4,
            padding: "0 3px",
            fontWeight: 600,
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

function groupConsecutive(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const lastMsg = last?.messages[last.messages.length - 1];

    const sameAuthor = last?.authorId === msg.authorId;
    const withinWindow =
      lastMsg !== undefined &&
      differenceInMinutes(msg.createdAt, lastMsg.createdAt) < 3;

    if (last && sameAuthor && withinWindow) {
      last.messages.push(msg);
    } else {
      groups.push({
        authorId: msg.authorId,
        author: msg.author,
        messages: [msg],
      });
    }
  }

  return groups;
}

function groupByDate(messages: Message[]): DateGroup[] {
  const dateMap = new Map<string, Message[]>();

  for (const msg of messages) {
    const key = format(msg.createdAt, "yyyy-MM-dd");
    const arr = dateMap.get(key) ?? [];
    arr.push(msg);
    dateMap.set(key, arr);
  }

  return Array.from(dateMap.entries()).map(([key, msgs]) => ({
    dateKey: key,
    dateLabel: formatDateDivider(msgs[0]!.createdAt),
    representativeDate: msgs[0]!.createdAt,
    groups: groupConsecutive(msgs),
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-5 select-none">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] text-text-3 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function AiIcon() {
  return (
    <span
      className="w-[20px] h-[20px] rounded-full bg-blue flex items-center justify-center shrink-0"
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="#fff" strokeWidth="1.5" aria-hidden="true">
        <circle cx="7" cy="7" r="3" />
        <path d="M7 1v2M7 11v2M1 7h2M11 7h2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function TopicSummaryCard({ summary }: { summary: TopicSummary }) {
  return (
    <div className="klip-resumo blue shrink-0">
      {/* Header */}
      <div className="klip-resumo-header">
        <span className="klip-resumo-dot" style={{ background: "var(--klip-blue)" }} />
        <span className="klip-resumo-label" style={{ color: "var(--klip-blue)", flex: 1 }}>
          Klip resumiu
        </span>
        <span style={{ fontSize: 10, color: "var(--klip-text-4)", fontFamily: "var(--klip-font-mono)" }}>
          {formatTimeAgo(summary.generatedAt)}
        </span>
      </div>

      {/* Synthesis */}
      <p className="klip-resumo-text">
        {summary.content}
      </p>

      {/* Decisions as bullet items */}
      {summary.decisions.length > 0 && (
        <ul className="klip-resumo-items" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {summary.decisions.map((decision, i) => (
            <li key={i} className="klip-resumo-item">{decision}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MessageAvatar({
  author,
  isFirst,
}: {
  author: MessageAuthor;
  isFirst: boolean;
}) {
  const { theme, mounted } = useDarkMode();
  const isDark = mounted && theme === "dark";

  if (!isFirst) {
    return <div style={{ width: 26, flexShrink: 0 }} />;
  }

  const style = getAvatarStyle(author.id, isDark);
  const initials = getInitials(author.name);

  return (
    <div
      className="klip-avatar shrink-0 mt-[1px]"
      style={style}
      aria-hidden="true"
      title={author.name}
    >
      {author.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={author.imageUrl}
          alt={author.name}
          className="w-full h-full object-cover"
          style={{ borderRadius: "50%" }}
        />
      ) : (
        initials
      )}
    </div>
  );
}

function ReplyQuote({ authorName, content }: { authorName: string; content: string }) {
  return (
    <div
      className="flex items-start gap-[8px] mb-[6px] rounded-[6px] px-[10px] py-[6px]"
      style={{
        background: "var(--color-bg-subtle)",
        borderLeft: "2.5px solid var(--color-blue-bright)",
      }}
    >
      <span className="text-[11px] font-semibold text-blue shrink-0">{authorName}</span>
      <span className="text-[11px] text-text-3 truncate leading-[1.4]">
        {content.length > 80 ? content.slice(0, 80) + "…" : content}
      </span>
    </div>
  );
}

// ─── Reactions + Hover bar ────────────────────────────────────────────────────

const EMOJI_PALETTE = ["👍", "❤️", "🔥", "✅", "😂", "🤔"] as const;

/** Small emoji picker that floats above the hover bar */
function EmojiPopover({ onPick, isDark }: { onPick: (e: string) => void; isDark: boolean }) {
  const bg = isDark ? "#1A2438" : "#FFFFFF";
  const border = isDark ? "1px solid rgba(255,255,255,.12)" : "1px solid #DDE3EE";
  const shadow = isDark ? "0 2px 8px rgba(0,0,0,.4)" : "0 2px 12px rgba(0,0,0,.12)";
  return (
    <div
      className="absolute bottom-full right-0 mb-1 z-50 flex gap-[6px] px-2 py-2 rounded-[10px]"
      style={{ background: bg, border, boxShadow: shadow }}
    >
      {EMOJI_PALETTE.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(emoji); }}
          className="text-[20px] leading-none transition-transform hover:scale-[1.3] cursor-pointer"
          style={{ transition: "transform .15s" }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** Reaction bubbles that live below the message text */
function ReactionBubbles({
  messageId,
  reactions,
  onReactionsChange,
}: {
  messageId: string;
  reactions: Reaction[];
  onReactionsChange: (messageId: string, next: Reaction[]) => void;
}) {
  const { getToken } = useAuth();

  const toggle = useCallback(async (emoji: string) => {
    const { next, method } = computeNextReactions(reactions, emoji);
    onReactionsChange(messageId, next);

    const token = await getToken();
    await fetch(`${API_URL}/api/messages/${messageId}/reactions`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ emoji }),
    }).catch(() => null);
  }, [reactions, messageId, getToken, onReactionsChange]);

  if (reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => void toggle(r.emoji)}
          className="inline-flex items-center gap-[4px] transition-colors cursor-pointer"
          style={{
            background: r.reactedByMe ? "rgba(74,158,255,.1)" : "rgba(255,255,255,.06)",
            border: r.reactedByMe ? "1px solid #4A9EFF" : "1px solid rgba(255,255,255,.1)",
            borderRadius: 12,
            padding: "2px 8px",
            fontSize: 14,
          }}
          onMouseEnter={(e) => {
            if (!r.reactedByMe) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.1)";
          }}
          onMouseLeave={(e) => {
            if (!r.reactedByMe) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.06)";
          }}
        >
          <span>{r.emoji}</span>
          <span style={{ fontSize: 12, color: "#C8D8E8", fontWeight: 600 }}>{r.count}</span>
        </button>
      ))}
    </div>
  );
}

/** Unified floating action bar — Slack/Discord style */
function MessageHoverBar({
  msg,
  onKlip,
  onReply,
  canSave,
  onReactionsChange,
  onPin,
  isAdmin,
  isDark,
}: {
  msg: Message;
  onKlip?: () => void;
  onReply?: () => void;
  canSave?: boolean;
  onReactionsChange?: (messageId: string, next: Reaction[]) => void;
  onPin?: (msg: Message) => void;
  isAdmin?: boolean;
  isDark: boolean;
}) {
  const { getToken } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const barBg = isDark ? "#1A2438" : "#FFFFFF";
  const barBorder = isDark ? "1px solid rgba(255,255,255,.12)" : "1px solid #DDE3EE";
  const barShadow = isDark ? "0 2px 8px rgba(0,0,0,.4)" : "0 2px 12px rgba(0,0,0,.12)";
  const btnColor = isDark ? "#7A90A8" : "#8A96A8";
  const btnHoverColor = isDark ? "#F0F4FA" : "#0F1923";
  const sepColor = isDark ? "rgba(255,255,255,.12)" : "#DDE3EE";

  const handleReact = useCallback(async (emoji: string) => {
    setPickerOpen(false);
    if (!onReactionsChange) return;
    const { next, method } = computeNextReactions(msg.reactions ?? [], emoji);
    onReactionsChange(msg.id, next);

    const token = await getToken();
    await fetch(`${API_URL}/api/messages/${msg.id}/reactions`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ emoji }),
    }).catch(() => null);
  }, [msg, getToken, onReactionsChange]);

  const btnStyle: React.CSSProperties = {
    color: btnColor,
    background: "transparent",
    border: "none",
    padding: "0 6px",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    lineHeight: 1,
    transition: "color .15s",
  };

  return (
    <div
      className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20"
      style={{ top: -16, right: 8 }}
    >
      <div
        className="flex items-center gap-0"
        style={{ background: barBg, border: barBorder, borderRadius: 8, padding: "4px 8px", boxShadow: barShadow }}
      >
        {/* Emoji icon — opens picker */}
        <div className="relative flex items-center">
          <button
            type="button"
            title="Adicionar reação"
            onMouseDown={(e) => { e.preventDefault(); setPickerOpen((o) => !o); }}
            className="flex items-center justify-center transition-colors"
            style={{ ...btnStyle, padding: "0 4px" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = btnHoverColor; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = btnColor; }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="5.8" cy="6.5" r="0.8" fill="currentColor" />
              <circle cx="10.2" cy="6.5" r="0.8" fill="currentColor" />
              <path d="M5.5 9.5C5.5 9.5 6.3 11 8 11C9.7 11 10.5 9.5 10.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          {pickerOpen && (
            <EmojiPopover onPick={(emoji) => void handleReact(emoji)} isDark={isDark} />
          )}
        </div>

        {/* Separator */}
        <span style={{ width: 1, height: 14, background: sepColor, margin: "0 6px", display: "inline-block", flexShrink: 0 }} />

        {onReply && (
          <button
            type="button"
            onClick={onReply}
            style={btnStyle}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = btnHoverColor; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = btnColor; }}
          >
            Responder
          </button>
        )}

        {isAdmin && onKlip && (
          <button
            type="button"
            onClick={onKlip}
            disabled={msg.isKlipped}
            style={{ ...btnStyle, color: msg.isKlipped ? "#22C98A" : btnColor, opacity: msg.isKlipped ? 0.6 : 1 }}
            onMouseEnter={(e) => { if (!msg.isKlipped) (e.currentTarget as HTMLButtonElement).style.color = "#22C98A"; }}
            onMouseLeave={(e) => { if (!msg.isKlipped) (e.currentTarget as HTMLButtonElement).style.color = btnColor; }}
          >
            {msg.isKlipped ? "Klipado" : "Klipar"}
          </button>
        )}

        {canSave && (
          <SaveButton
            messageId={msg.id}
            initialSaved={msg.savedByCurrentUser ?? false}
            btnStyle={btnStyle}
            btnColor={btnColor}
            btnHoverColor={btnHoverColor}
          />
        )}

        {onPin && (
          <button
            type="button"
            onClick={() => onPin(msg)}
            style={btnStyle}
            title="Fixar mensagem"
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#4A9EFF"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = btnColor; }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 2l5 5-6 6-1-3-4 4-1-1 4-4-3-1z" />
              <path d="M2 14l3-3" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function KlippedBadge() {
  return (
    <div className="klip-badge green" style={{ display: "inline-flex" }}>
      <span>✦</span>
      klipado
    </div>
  );
}

function MessageRow({
  msg,
  isFirst,
  isOwn,
  onKlip,
  onReply,
  isAdmin,
  canSave,
  onReactionsChange,
  onPin,
  isHighlighted,
}: {
  msg: Message;
  isFirst: boolean;
  isOwn: boolean;
  onKlip?: (messageId: string) => void;
  onReply?: (msg: Message) => void;
  isAdmin?: boolean;
  canSave?: boolean;
  onReactionsChange?: (messageId: string, next: Reaction[]) => void;
  onPin?: (msg: Message) => void;
  isHighlighted?: boolean;
}) {
  const { theme, mounted } = useDarkMode();
  const isDark = mounted ? theme === "dark" : true; // default dark to match app default
  // Soft-deleted message
  if (msg.deletedAt !== null) {
    return (
      <div className="flex gap-[10px] px-[6px] py-1">
        <div className="w-8 shrink-0" />
        <span className="text-text-3 italic text-sm">[mensagem removida]</span>
      </div>
    );
  }

  const isAiMessage = msg.authorId === "klip-ai";

  if (isAiMessage) {
    return (
      <div
        id={`msg-${msg.id}`}
        className="flex gap-[11px]"
        style={{
          background: "var(--color-blue-dim)",
          border: "1px solid var(--color-blue-border)",
          borderLeft: "3px solid var(--color-blue)",
          borderRadius: 14,
          margin: "3px 12px",
          padding: "10px 12px",
          transition: "background 0.2s, border-color 0.2s",
        }}
      >
        {/* AI avatar */}
        <div
          className="klip-avatar shrink-0 mt-[1px]"
          style={{ background: "linear-gradient(135deg, #4A9EFF, #1249A0)" }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.03em" }}>kl</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="klip-ai-label">@klip</p>
          <p className="klip-msg-text break-words whitespace-pre-wrap">
            {parseInline(msg.content)}
          </p>
          <span style={{ fontSize: 9, color: "var(--klip-text-4)", fontFamily: "var(--klip-font-mono)" }}>
            {formatTimestamp(msg.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`msg-${msg.id}`}
      className={cn(
        "group relative flex gap-[11px]",
        "hover:bg-bg-subtle",
        isOwn && "flex-row",
        isHighlighted && "ring-2 ring-inset ring-blue"
      )}
      style={{
        background: isHighlighted ? "rgba(74,158,255,.08)" : "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 14,
        margin: "3px 12px",
        padding: "10px 12px",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      <MessageAvatar author={msg.author} isFirst={isFirst} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Reply quote */}
        {msg.replyToId && msg.replyToAuthorName && msg.replyToContent && (
          <ReplyQuote authorName={msg.replyToAuthorName} content={msg.replyToContent} />
        )}

        {isFirst && (
          <div className="flex items-baseline gap-[8px] mb-[3px]">
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--klip-text-1)", lineHeight: 1 }}>
              {msg.author.name}
            </span>
            <span className="klip-msg-author" style={{ fontFamily: "var(--klip-font-mono)", lineHeight: 1 }}>
              {formatTimestamp(msg.createdAt)}
            </span>
            {msg.isEdited && (
              <span style={{ fontSize: 10, color: "var(--klip-text-4)", fontStyle: "italic", lineHeight: 1 }}>
                (editado)
              </span>
            )}
          </div>
        )}

        {msg.content && (
          <p className="klip-msg-text break-words">
            {parseInline(msg.content)}
          </p>
        )}

        {/* Attachments */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {msg.attachments.map((att, i) =>
              att.type === "image" ? (
                <AttachmentImage key={i} attachment={att} />
              ) : (
                <AudioPlayer key={i} attachment={att} />
              )
            )}
          </div>
        )}

        {msg.isKlipped && <KlippedBadge />}

        <ReactionBubbles
          messageId={msg.id}
          reactions={msg.reactions ?? []}
          onReactionsChange={onReactionsChange ?? (() => {})}
        />
      </div>

      <MessageHoverBar
        msg={msg}
        isDark={isDark}
        {...(onKlip ? { onKlip: () => onKlip(msg.id) } : {})}
        {...(onReply ? { onReply: () => onReply(msg) } : {})}
        isAdmin={isAdmin ?? false}
        canSave={canSave ?? false}
        {...(onReactionsChange ? { onReactionsChange } : {})}
        {...(onPin ? { onPin } : {})}
      />
    </div>
  );
}

function MessageGroupBlock({
  group,
  onKlip,
  onReply,
  isAdmin,
  canSave,
  onReactionsChange,
  onPin,
  highlightedMessageId,
}: {
  group: MessageGroup;
  onKlip?: (messageId: string) => void;
  onReply?: (msg: Message) => void;
  isAdmin?: boolean;
  canSave?: boolean;
  onReactionsChange?: (messageId: string, next: Reaction[]) => void;
  onPin?: (msg: Message) => void;
  highlightedMessageId?: string | null;
}) {
  return (
    <div>
      {group.messages.map((msg, i) => (
        <MessageRow
          key={msg.id}
          msg={msg}
          isFirst={i === 0}
          isOwn={false}
          {...(onKlip ? { onKlip } : {})}
          {...(onReply ? { onReply } : {})}
          isAdmin={isAdmin ?? false}
          canSave={canSave ?? false}
          {...(onReactionsChange ? { onReactionsChange } : {})}
          {...(onPin ? { onPin } : {})}
          isHighlighted={highlightedMessageId === msg.id}
        />
      ))}
    </div>
  );
}

function KlipThinkingIndicator() {
  return (
    <div className="flex items-center gap-[10px] px-[8px] py-[8px] mt-1">
      <div
        className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: "rgba(74,158,255,.15)", border: "1px solid rgba(74,158,255,.25)" }}
      >
        <span style={{ fontSize: 14, color: "#4A9EFF" }}>✦</span>
      </div>
      <div className="flex items-center gap-[8px]">
        <span className="text-[13px] font-semibold text-blue">@klip</span>
        <span className="text-[13px] text-text-3 italic">está pensando…</span>
        <span className="flex gap-[3px]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-[5px] h-[5px] rounded-full bg-blue"
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

function PrivateKlipPanel({ response, onClose }: { response: string; onClose: () => void }) {
  return (
    <div
      className="mx-[8px] mb-2 rounded-[12px] p-[14px_16px]"
      style={{
        background: "rgba(74,158,255,.06)",
        border: "1px solid rgba(74,158,255,.2)",
        borderLeft: "3px solid #4A9EFF",
      }}
    >
      <div className="flex items-center justify-between mb-[8px]">
        <div className="flex items-center gap-[8px]">
          <span style={{ fontSize: 12, color: "#4A9EFF" }}>✦</span>
          <span className="text-[12px] font-semibold text-blue">Resposta privada do @klip</span>
          <span
            className="text-[10px] px-[6px] py-[1px] rounded-[4px]"
            style={{ background: "rgba(74,158,255,.12)", color: "#4A9EFF" }}
          >
            só você vê
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-text-3 hover:text-text-2 leading-none text-[16px] transition-colors"
          aria-label="Fechar resposta"
        >
          ×
        </button>
      </div>
      <p className="text-[13px] text-text-2 leading-[1.7] whitespace-pre-wrap">{response}</p>
    </div>
  );
}

function TypingIndicator({ users }: { users: TypingUser[] }) {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-[10px] px-[6px] py-2 mt-1">
      <div className="w-8 shrink-0" />
      <span className="text-[13px] text-text-3 italic">
        {getTypingText(users)}
      </span>
    </div>
  );
}

// ─── MessageFeed ──────────────────────────────────────────────────────────────

export function MessageFeed({
  messages: initialMessages,
  currentUserId: _currentUserId,
  topicSummary,
  typingUsers = [],
  onKlipMessage,
  onReply,
  onPin,
  isAdmin,
  canSave,
  highlightedMessageId,
  klipThinking,
  privateKlipResponse,
  onClearPrivateResponse,
}: MessageFeedProps) {
  // Local reactions state — keyed by messageId
  const [reactionsMap, setReactionsMap] = useState<Record<string, Reaction[]>>({});

  // URL hash highlight — auto-scroll to #msg-{id} on mount
  const [hashHighlightId, setHashHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#msg-")) return;
    const msgId = hash.slice(5);
    setHashHighlightId(msgId);
    const scrollTimer = setTimeout(() => {
      document.getElementById(`msg-${msgId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    const clearTimer = setTimeout(() => setHashHighlightId(null), 2700);
    return () => { clearTimeout(scrollTimer); clearTimeout(clearTimer); };
  }, []);

  const handleReactionsChange = useCallback((messageId: string, next: Reaction[]) => {
    setReactionsMap((prev) => ({ ...prev, [messageId]: next }));
  }, []);

  // Merge server messages with local reaction overrides
  const messages = initialMessages.map((m): Message => {
    const override = reactionsMap[m.id];
    return override ? { ...m, reactions: override } : m;
  });

  const dateGroups = groupByDate(
    [...messages].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-page">
      {/* KLIP RESUMIU — fixo acima do scroll, nunca dentro dele */}
      {topicSummary && <TopicSummaryCard summary={topicSummary} />}

      {/* Área de scroll */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-4 flex flex-col">
      {/* Message groups by date */}
      <div className="flex-1">
        {dateGroups.map((dateGroup) => (
          <div key={dateGroup.dateKey}>
            <DateDivider label={dateGroup.dateLabel} />
            {dateGroup.groups.map((group) => (
              <MessageGroupBlock
                key={`${group.authorId}-${group.messages[0]!.id}`}
                group={group}
                {...(onKlipMessage ? { onKlip: onKlipMessage } : {})}
                {...(onReply ? { onReply } : {})}
                isAdmin={isAdmin ?? false}
                canSave={canSave ?? false}
                onReactionsChange={handleReactionsChange}
                {...(onPin ? { onPin } : {})}
                highlightedMessageId={highlightedMessageId ?? hashHighlightId ?? null}
              />
            ))}
          </div>
        ))}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-[12px] py-16">
            {/* Logo mark */}
            <span
              className="flex items-center justify-center rounded-[12px] text-white font-bold text-[18px]"
              style={{
                width: 48,
                height: 48,
                background: "var(--color-blue)",
                boxShadow: "0 2px 10px rgba(18,73,160,.28)",
                letterSpacing: "-0.5px",
              }}
            >
              kl
            </span>
            <div className="text-center">
              <p className="text-[14px] font-semibold text-text-2">Nenhuma mensagem ainda</p>
              <p className="text-[13px] text-text-3 mt-[4px]">Seja o primeiro a escrever neste tópico</p>
            </div>
          </div>
        )}
      </div>

      {/* Private @klip response panel */}
      {privateKlipResponse && onClearPrivateResponse && (
        <PrivateKlipPanel response={privateKlipResponse} onClose={onClearPrivateResponse} />
      )}

      {/* @klip thinking indicator */}
      {klipThinking && <KlipThinkingIndicator />}

      {/* Typing indicator — pinned at bottom */}
      <TypingIndicator users={typingUsers} />
      </div>{/* fim área de scroll */}
    </div>
  );
}

// Re-export currentUserId consumer helper
export { type MessageFeedProps as MessageFeedPropsType };

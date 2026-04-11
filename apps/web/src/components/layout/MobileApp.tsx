"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useTopicSocket } from "@/hooks/useTopicSocket";
import type { MessageWithAuthor, TypingUser, Attachment } from "@/hooks/useTopicSocket";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  bg:      "#08111f",
  surface: "#0d1e35",
  border:  "#1a2e4a",
  accent:  "#4A9EFF",
  green:   "#22C98A",
  t1:      "#ffffff",
  t2:      "#e0eaf6",
  t3:      "#8AAAC8",
  t4:      "#5a7a9a",
} as const;

const FONT = "-apple-system, 'SF Pro Display', system-ui, sans-serif";
const ACCENTS = [T.accent, T.green, "#8B7EFF", "#F5C842", "#FF6B6B"] as const;

type Screen = "communities" | "topics" | "chat";
const SCREENS: Screen[] = ["communities", "topics", "chat"];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Community {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
}

interface Topic {
  id: string;
  title: string;
  messageCount: number;
  status: "open" | "resolved" | "pinned";
  isPinned?: boolean;
  lastActivityAt?: string;
}

interface Msg {
  id: string;
  topicId: string;
  authorId: string;
  content: string;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  author: { id: string; name: string };
  attachments?: Attachment[];
  replyToId?: string | null;
  replyToAuthorName?: string | null;
  replyToContent?: string | null;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function accentFor(id: string): string {
  const n = parseInt(id.replace(/-/g, "").slice(0, 6), 16);
  return ACCENTS[n % ACCENTS.length]!;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(d: Date): string {
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "hoje";
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

// ─── TopNav ─────────────────────────────────────────────────────────────────────

function TopNav({
  title,
  onBack,
}: {
  title?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        paddingLeft: 2,
        paddingRight: 16,
        paddingTop: "calc(env(safe-area-inset-top) + 10px)",
        paddingBottom: 10,
        background: T.bg,
        position: "sticky",
        top: 0,
        zIndex: 50,
        flexShrink: 0,
        fontFamily: FONT,
      }}
    >
      {/* Back chevron — always occupies 44px so title stays flush left */}
      <button
        type="button"
        onClick={onBack}
        aria-label="Voltar"
        style={{
          width: 44,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: "none",
          color: T.accent,
          cursor: onBack ? "pointer" : "default",
          borderRadius: 12,
          opacity: onBack ? 1 : 0,
          pointerEvents: onBack ? "auto" : "none",
          flexShrink: 0,
          padding: 0,
        }}
      >
        <svg width="10" height="17" viewBox="0 0 10 17" fill="none" aria-hidden="true">
          <path d="M8.5 1.5L1.5 8.5L8.5 15.5" stroke={T.accent} strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Title or logo */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", overflow: "hidden" }}>
        {title ?? (
          /* Logo: badge + wordmark */
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 9, background: T.accent,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 800, color: "#fff",
              letterSpacing: "-0.5px", flexShrink: 0, userSelect: "none",
            }}>
              kl
            </span>
            <span style={{
              fontSize: 22, fontWeight: 800, letterSpacing: "-0.8px",
              lineHeight: 1, userSelect: "none",
            }}>
              <span style={{ color: T.t1 }}>k</span>
              <span style={{ color: T.accent }}>l</span>
              <span style={{ color: T.t1 }}>ip</span>
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── CommunityCard ──────────────────────────────────────────────────────────────

function CommunityCard({
  community,
  index,
  onPress,
}: {
  community: Community;
  index: number;
  onPress: () => void;
}) {
  const accent = accentFor(community.id);
  const ini = initials(community.name);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onPress}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      aria-label={`Abrir comunidade ${community.name}`}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: pressed ? `${T.surface}cc` : T.surface,
        border: `0.5px solid ${T.border}`,
        borderRadius: 18,
        overflow: "hidden",
        cursor: "pointer",
        padding: 0,
        transform: pressed ? "scale(0.985)" : "scale(1)",
        transition: "transform .12s ease, background .1s ease",
        fontFamily: FONT,
      }}
    >
      {/* Colored top stripe */}
      <div style={{ height: 3, background: accent }} />

      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
        {/* Initials badge */}
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${accent}22`,
          border: `1px solid ${accent}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>{ini}</span>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, color: T.t1,
            letterSpacing: "-0.2px", marginBottom: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {community.name}
          </div>
          {community.description && (
            <div style={{
              fontSize: 12, color: T.t3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {community.description}
            </div>
          )}
        </div>

        {/* Chevron */}
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
          <path d="M1 1L6 6L1 11" stroke={T.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  );
}

// ─── TopicCard ──────────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  accent,
  onPress,
}: {
  topic: Topic;
  accent: string;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  const dot =
    topic.status === "resolved" ? { color: T.green, label: "Resolvido" }
    : topic.isPinned             ? { color: "#F5C842", label: "Fixado" }
    :                              { color: accent,    label: "Ativo" };

  return (
    <button
      type="button"
      onClick={onPress}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      aria-label={`Abrir tópico ${topic.title}`}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: pressed ? `${T.surface}cc` : T.surface,
        border: `0.5px solid ${T.border}`,
        borderRadius: 14,
        padding: "14px 16px",
        cursor: "pointer",
        transform: pressed ? "scale(0.985)" : "scale(1)",
        transition: "transform .12s ease, background .1s ease",
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: T.t1,
            letterSpacing: "-0.2px", marginBottom: 6, lineHeight: 1.3,
          }}>
            {topic.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: dot.color, flexShrink: 0,
              boxShadow: `0 0 6px ${dot.color}88`,
            }} />
            <span style={{ fontSize: 11, color: T.t3, fontWeight: 500 }}>{dot.label}</span>
            <span style={{ fontSize: 11, color: T.t4 }}>·</span>
            <span style={{ fontSize: 11, color: T.t4 }}>{topic.messageCount} msg</span>
          </div>
        </div>
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" style={{ flexShrink: 0, marginTop: 3 }} aria-hidden="true">
          <path d="M1 1L6 6L1 11" stroke={T.t4} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  );
}

// ─── DateDivider ─────────────────────────────────────────────────────────────────

function DateDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 8px", fontFamily: FONT }}>
      <div style={{ flex: 1, height: 1, background: T.border }} />
      <span style={{
        fontSize: 10, fontWeight: 600, color: T.t4,
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );
}

// ─── MessageBubble ──────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isFirst,
  isOwn,
}: {
  msg: Msg;
  isFirst: boolean;
  isOwn: boolean;
}) {
  void isOwn; // reserved for future own-message right-aligned style

  if (msg.deletedAt) {
    return (
      <div style={{ padding: "2px 14px 2px 56px", fontFamily: FONT }}>
        <span style={{ fontSize: 13, color: T.t4, fontStyle: "italic" }}>[mensagem removida]</span>
      </div>
    );
  }

  if (msg.authorId === "klip-ai") {
    return (
      <div style={{ padding: "8px 14px 4px", fontFamily: FONT }}>
        <div style={{
          background: `${T.accent}08`,
          border: `1px solid ${T.accent}22`,
          borderLeft: `3px solid ${T.accent}`,
          borderRadius: "4px 14px 14px 14px",
          padding: "10px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <span style={{
              width: 18, height: 18, borderRadius: "50%",
              background: `${T.accent}22`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, color: T.accent, fontWeight: 700,
            }}>✦</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>@klip</span>
            <span style={{ fontSize: 10, color: T.t4, marginLeft: "auto" }}>{fmtTime(msg.createdAt)}</span>
          </div>
          <p style={{ fontSize: 13, color: T.t2, lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {msg.content}
          </p>
        </div>
      </div>
    );
  }

  const avatarHue = parseInt(msg.authorId.replace(/-/g, "").slice(0, 6), 16) % 360;

  return (
    <div style={{
      display: "flex",
      gap: 10,
      paddingLeft: 14,
      paddingRight: 14,
      paddingTop: isFirst ? 8 : 2,
      paddingBottom: 2,
      alignItems: "flex-start",
      fontFamily: FONT,
    }}>
      {/* Avatar or spacer (44px tap target met via row height) */}
      <div style={{ width: 32, flexShrink: 0 }}>
        {isFirst && (
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: `hsl(${avatarHue}, 45%, 18%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700,
            color: `hsl(${avatarHue}, 80%, 72%)`,
          }}>
            {initials(msg.author.name)}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isFirst && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.t1, letterSpacing: "-0.1px" }}>
              {msg.author.name}
            </span>
            <span style={{ fontSize: 10, color: T.t4 }}>{fmtTime(msg.createdAt)}</span>
            {msg.isEdited && <span style={{ fontSize: 10, color: T.t4, fontStyle: "italic" }}>(editado)</span>}
          </div>
        )}

        {/* Reply quote */}
        {msg.replyToId && msg.replyToAuthorName && msg.replyToContent && (
          <div style={{
            borderLeft: `2px solid ${T.accent}`,
            paddingLeft: 8,
            marginBottom: 5,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, marginBottom: 1 }}>
              {msg.replyToAuthorName}
            </div>
            <div style={{ fontSize: 11, color: T.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {msg.replyToContent.length > 60 ? msg.replyToContent.slice(0, 60) + "…" : msg.replyToContent}
            </div>
          </div>
        )}

        {/* Bubble */}
        {msg.content && (
          <div style={{
            background: T.surface,
            border: `0.5px solid ${T.border}`,
            borderRadius: "4px 14px 14px 14px",
            padding: "8px 12px",
            display: "inline-block",
            maxWidth: "100%",
          }}>
            <p style={{ fontSize: 13, color: T.t2, lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {msg.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ChatInput ──────────────────────────────────────────────────────────────────

function ChatInput({
  onSend,
  onTyping,
  disabled,
}: {
  onSend: (text: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function send() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
    if (taRef.current) taRef.current.style.height = "auto";
  }

  const canSend = text.trim().length > 0;

  return (
    <div style={{
      background: T.bg,
      borderTop: `1px solid ${T.border}`,
      padding: "10px 14px",
      paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
      display: "flex",
      gap: 10,
      alignItems: "flex-end",
      flexShrink: 0,
      fontFamily: FONT,
    }}>
      <textarea
        ref={taRef}
        value={text}
        rows={1}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          onTyping?.();
        }}
        onInput={resize}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
        }}
        placeholder="Mensagem…"
        aria-label="Campo de mensagem"
        style={{
          flex: 1,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 14,
          color: T.t1,
          resize: "none",
          outline: "none",
          fontFamily: FONT,
          lineHeight: 1.4,
          minHeight: 42,
          maxHeight: 120,
          WebkitAppearance: "none",
        }}
      />
      <button
        type="button"
        onClick={send}
        disabled={!canSend || disabled}
        aria-label="Enviar mensagem"
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: canSend ? T.accent : `${T.accent}44`,
          border: "none",
          color: "#fff",
          cursor: canSend ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background .15s",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 13V3M8 3L4 7M8 3L12 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────────

function Spinner({ color = T.accent }: { color?: string }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: "50%",
      border: `2.5px solid ${color}`,
      borderTopColor: "transparent",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

// ─── ChatScreen ─────────────────────────────────────────────────────────────────
// Mounted with key={topic.id} — remounts cleanly when user changes topic

interface ChatScreenProps {
  topic: Topic;
  communityId: string;
  userId: string;
  userName: string;
  getToken: () => Promise<string | null>;
}

function ChatScreen({ topic, userId, userName, getToken }: ChatScreenProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState<TypingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load initial messages
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/messages?topicId=${topic.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok || cancelled) return;
        const raw = await res.json() as {
          messages?: Array<{
            id: string; topicId: string; authorId: string; authorName?: string;
            content: string; isEdited: boolean;
            createdAt: string; updatedAt: string; deletedAt: string | null;
            replyToId?: string | null; replyToAuthorName?: string | null; replyToContent?: string | null;
          }>
        };
        if (!cancelled) {
          setMessages(
            (raw.messages ?? []).map((m) => ({
              id: m.id, topicId: m.topicId, authorId: m.authorId,
              content: m.content, isEdited: m.isEdited,
              createdAt: new Date(m.createdAt), updatedAt: new Date(m.updatedAt),
              deletedAt: m.deletedAt ? new Date(m.deletedAt) : null,
              author: { id: m.authorId, name: m.authorName ?? m.authorId },
              replyToId: m.replyToId ?? null,
              replyToAuthorName: m.replyToAuthorName ?? null,
              replyToContent: m.replyToContent ?? null,
            }))
          );
        }
      } catch { /* non-fatal */ }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [topic.id, getToken]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // Socket callbacks
  const handleNew = useCallback((msg: MessageWithAuthor & { tempId?: string }) => {
    setMessages((prev) => {
      if (msg.tempId) {
        const idx = prev.findIndex((m) => m.id === msg.tempId);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = {
            id: msg.id, topicId: msg.topicId, authorId: msg.authorId,
            content: msg.content, isEdited: msg.isEdited,
            createdAt: msg.createdAt, updatedAt: msg.updatedAt, deletedAt: msg.deletedAt,
            author: { id: msg.authorId, name: msg.authorName },
            attachments: msg.attachments,
            replyToId: msg.replyToId ?? null, replyToAuthorName: msg.replyToAuthorName ?? null,
            replyToContent: msg.replyToContent ?? null,
          };
          return next;
        }
      }
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, {
        id: msg.id, topicId: msg.topicId, authorId: msg.authorId,
        content: msg.content, isEdited: msg.isEdited,
        createdAt: msg.createdAt, updatedAt: msg.updatedAt, deletedAt: msg.deletedAt,
        author: { id: msg.authorId, name: msg.authorName },
        attachments: msg.attachments,
        replyToId: msg.replyToId ?? null, replyToAuthorName: msg.replyToAuthorName ?? null,
        replyToContent: msg.replyToContent ?? null,
      }];
    });
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, deletedAt: new Date() } : m));
  }, []);

  const handleTyping = useCallback((users: TypingUser[]) => setTyping(users), []);

  const { sendMessage, startTyping, stopTyping } = useTopicSocket({
    topicId: topic.id,
    getToken,
    onMessageNew: handleNew,
    onMessageDeleted: handleDeleted,
    onTypingUpdate: handleTyping,
    onSummaryUpdated: () => { /* not used in mobile chat */ },
  });

  // Build chronological, grouped message list
  const sorted = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const rows: Array<
    | { type: "date"; label: string }
    | { type: "msg"; msg: Msg; isFirst: boolean; isOwn: boolean }
  > = [];

  let lastDate = "";
  let lastAuthorId = "";
  let lastTime: Date | null = null;

  for (const msg of sorted) {
    const dateKey = msg.createdAt.toDateString();
    if (dateKey !== lastDate) {
      rows.push({ type: "date", label: fmtDay(msg.createdAt) });
      lastDate = dateKey;
      lastAuthorId = "";
      lastTime = null;
    }
    const sameBurst =
      msg.authorId === lastAuthorId &&
      lastTime !== null &&
      (msg.createdAt.getTime() - lastTime.getTime()) / 60000 < 3;
    rows.push({ type: "msg", msg, isFirst: !sameBurst, isOwn: msg.authorId === userId });
    lastAuthorId = msg.authorId;
    lastTime = msg.createdAt;
  }

  function handleSend(text: string) {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    sendMessage(text, [], undefined);
    setMessages((prev) => [...prev, {
      id: tempId, topicId: topic.id, authorId: userId,
      content: text, isEdited: false,
      createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      author: { id: userId, name: userName },
      replyToId: null, replyToAuthorName: null, replyToContent: null,
    }]);
  }

  function handleTypingKey() {
    startTyping();
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 2000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", fontFamily: FONT }}>
      {/* Message list */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <Spinner />
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <p style={{ fontSize: 28, marginBottom: 10 }}>💬</p>
            <p style={{ fontSize: 14, color: T.t3, lineHeight: 1.5 }}>
              Nenhuma mensagem ainda.<br />Seja o primeiro a escrever.
            </p>
          </div>
        )}

        {!loading && rows.map((row, i) =>
          row.type === "date"
            ? <DateDivider key={`d-${i}`} label={row.label} />
            : <MessageBubble key={row.msg.id} msg={row.msg} isFirst={row.isFirst} isOwn={row.isOwn} />
        )}

        {typing.length > 0 && (
          <div role="status" style={{ padding: "4px 56px 8px", fontSize: 12, color: T.t3, fontStyle: "italic", fontFamily: FONT }}>
            {typing[0]!.name} está digitando…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} onTyping={handleTypingKey} />
    </div>
  );
}

// ─── MobileAppInner ─────────────────────────────────────────────────────────────

interface MobileAppInnerProps {
  initialCommunities: Community[];
  userId: string;
  userName: string;
  getToken: () => Promise<string | null>;
}

function MobileAppInner({ initialCommunities, userId, userName, getToken }: MobileAppInnerProps) {
  const [screen, setScreen] = useState<Screen>("communities");
  const [communities, setCommunities] = useState<Community[]>(initialCommunities);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  // If communities weren't server-passed, fetch client-side
  useEffect(() => {
    if (initialCommunities.length > 0) return;
    let cancelled = false;
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/communities`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok && !cancelled) setCommunities(await res.json() as Community[]);
      } catch { /* non-fatal */ }
    }
    void load();
    return () => { cancelled = true; };
  }, [getToken, initialCommunities.length]);

  const goToTopics = useCallback(async (community: Community) => {
    setSelectedCommunity(community);
    setTopics([]);
    setScreen("topics");
    setTopicsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/topics?communityId=${community.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json() as Topic[];
        setTopics(data);
      }
    } catch { /* non-fatal */ }
    finally { setTopicsLoading(false); }
  }, [getToken]);

  const goToChat = useCallback((topic: Topic) => {
    setSelectedTopic(topic);
    setScreen("chat");
  }, []);

  const goBack = useCallback(() => {
    if (screen === "chat") setScreen("topics");
    else if (screen === "topics") setScreen("communities");
  }, [screen]);

  const currentIdx = SCREENS.indexOf(screen);
  const communityAccent = selectedCommunity ? accentFor(selectedCommunity.id) : T.accent;

  function slideFor(s: Screen): string {
    const idx = SCREENS.indexOf(s);
    if (idx < currentIdx) return "translateX(-100%)";
    if (idx > currentIdx) return "translateX(100%)";
    return "translateX(0)";
  }

  const screenBase: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    transition: "transform 280ms ease-out",
    willChange: "transform",
    display: "flex",
    flexDirection: "column",
    background: T.bg,
    fontFamily: FONT,
  };

  return (
    <div style={{
      width: "100%",
      maxWidth: 430,
      margin: "0 auto",
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: T.bg,
      position: "relative",
      overflow: "hidden",
      fontFamily: FONT,
    }}>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* ── Screen 1: Communities ──────────────────────────────────────── */}
        <div style={{ ...screenBase, transform: slideFor("communities") }}>
          <TopNav />
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 40px" }}>
            <p style={{
              fontSize: 10, fontWeight: 600, color: T.t4,
              textTransform: "uppercase", letterSpacing: "0.08em",
              marginBottom: 12, marginTop: 4,
            }}>
              Suas comunidades
            </p>
            {communities.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <p style={{ fontSize: 14, color: T.t3 }}>Nenhuma comunidade ainda</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {communities.map((c, i) => (
                  <CommunityCard
                    key={c.id}
                    community={c}
                    index={i}
                    onPress={() => void goToTopics(c)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Screen 2: Topics ───────────────────────────────────────────── */}
        <div style={{ ...screenBase, transform: slideFor("topics") }}>
          <TopNav
            onBack={goBack}
            title={
              <span style={{
                fontSize: 17, fontWeight: 700, color: T.t1, letterSpacing: "-0.3px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {selectedCommunity?.name ?? "Tópicos"}
              </span>
            }
          />
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 40px" }}>
            {topicsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <Spinner color={communityAccent} />
              </div>
            ) : topics.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <p style={{ fontSize: 14, color: T.t3 }}>Nenhum tópico ainda</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topics.map((t) => (
                  <TopicCard
                    key={t.id}
                    topic={t}
                    accent={communityAccent}
                    onPress={() => goToChat(t)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Screen 3: Chat ─────────────────────────────────────────────── */}
        <div style={{ ...screenBase, transform: slideFor("chat") }}>
          <TopNav
            onBack={goBack}
            title={
              <span style={{
                fontSize: 16, fontWeight: 700, color: T.t1, letterSpacing: "-0.3px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {selectedTopic?.title ?? ""}
              </span>
            }
          />
          {selectedTopic && selectedCommunity ? (
            <ChatScreen
              key={selectedTopic.id}
              topic={selectedTopic}
              communityId={selectedCommunity.id}
              userId={userId}
              userName={userName}
              getToken={getToken}
            />
          ) : null}
        </div>

      </div>
    </div>
  );
}

// ─── Clerk wrapper ──────────────────────────────────────────────────────────────

function MobileAppWithClerk({ initialCommunities }: { initialCommunities: Community[] }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  return (
    <MobileAppInner
      initialCommunities={initialCommunities}
      userId={user?.id ?? "me"}
      userName={user?.fullName ?? user?.firstName ?? "Você"}
      getToken={getToken}
    />
  );
}

// ─── Public export ───────────────────────────────────────────────────────────────

export interface MobileAppProps {
  initialCommunities?: Community[];
}

export function MobileApp({ initialCommunities = [] }: MobileAppProps) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <MobileAppInner
        initialCommunities={initialCommunities}
        userId="dev-user"
        userName="Dev User"
        getToken={() => Promise.resolve(null)}
      />
    );
  }
  return <MobileAppWithClerk initialCommunities={initialCommunities} />;
}

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/hooks/useTopicSocket";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplyTarget {
  messageId: string;
  authorName: string;
  content: string;
}

export interface InputAreaProps {
  topicId: string;
  topicTitle: string;
  communityId?: string;
  onSendMessage: (content: string, attachments: Attachment[], replyTo?: ReplyTarget) => Promise<void>;
  onMarkDecision: () => void;
  onRequestSummary: () => void;
  onTyping?: () => void;
  disabled?: boolean;
  getToken?: () => Promise<string | null>;
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
}

/** Pending attachment — has a local preview URL before/instead of the final URL */
interface PendingAttachment {
  id: string;
  previewUrl: string; // object URL for images, blob URL for audio
  attachment: Attachment; // filled after upload completes
  uploading: boolean;
  error?: string;
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 13V3M8 3L4 7M8 3L12 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <rect x="1" y="1.5" width="9" height="8" rx="1" stroke="currentColor" strokeWidth="1" />
      <circle cx="3.5" cy="4" r="1" fill="currentColor" />
      <path d="M1 8L3.5 5.5L5.5 7.5L7 6L10 8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon({ active }: { active?: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <rect x="3.5" y="1" width="4" height="6" rx="2" stroke={active ? "currentColor" : "currentColor"} strokeWidth="1" fill={active ? "currentColor" : "none"} />
      <path d="M1.5 5.5C1.5 7.71 3.29 9.5 5.5 9.5C7.71 9.5 9.5 7.71 9.5 5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="5.5" y1="9.5" x2="5.5" y2="10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor" aria-hidden="true">
      <rect x="2" y="2" width="7" height="7" rx="1" />
    </svg>
  );
}

function DecisionIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M2 2C2 1.72 2.22 1.5 2.5 1.5H7L9.5 4V9.5C9.5 9.78 9.28 10 9 10H2.5C2.22 10 2 9.78 2 9.5V2Z" stroke="currentColor" strokeWidth="1" />
      <path d="M7 1.5V4H9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M3.5 5.5H7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M3.5 7.5H7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M5.5 1L6.4 4.2L9.5 5.5L6.4 6.8L5.5 10L4.6 6.8L1.5 5.5L4.6 4.2L5.5 1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "klip" | "danger";
  disabled?: boolean;
  active?: boolean;
}

function ToolbarButton({ icon, label, onClick, variant = "default", disabled = false, active = false }: ToolbarButtonProps) {
  const isKlip = variant === "klip";
  const isDanger = variant === "danger";

  let inlineStyle: React.CSSProperties;
  if (isKlip) {
    inlineStyle = {
      background: "transparent",
      border: "none",
      color: "#22C98A",
      fontWeight: 600,
    };
  } else if (isDanger) {
    inlineStyle = {
      background: "transparent",
      border: "none",
      color: "#ef4444",
    };
  } else if (active) {
    inlineStyle = {
      background: "rgba(74,158,255,.12)",
      border: "none",
      color: "#4A9EFF",
    };
  } else {
    inlineStyle = {
      background: "transparent",
      border: "none",
      color: "#6B8BAF",
    };
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-[5px] text-[11px] font-medium",
        "px-[8px] py-[4px] rounded-[6px] transition-colors leading-none",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        isKlip && "hover:bg-[rgba(34,201,138,.08)]",
        isDanger && "hover:bg-[rgba(239,68,68,.08)]",
        !isKlip && !isDanger && "hover:bg-[rgba(255,255,255,.06)]",
      )}
      style={inlineStyle}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Pending attachment previews ──────────────────────────────────────────────

function ImagePreviewItem({ item, onRemove }: { item: PendingAttachment; onRemove: () => void }) {
  return (
    <div className="relative shrink-0" style={{ width: 72, height: 72 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.previewUrl}
        alt={item.attachment.name}
        className="w-full h-full object-cover rounded-[8px]"
        style={{ border: "1.5px solid rgba(74,158,255,.3)" }}
      />
      {item.uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[8px]">
          <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
        </div>
      )}
      {item.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/30 rounded-[8px]">
          <span className="text-[9px] text-white font-medium px-1 text-center leading-tight">{item.error}</span>
        </div>
      )}
      {!item.uploading && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover imagem"
          className="absolute -top-[7px] -right-[7px] flex items-center justify-center leading-none hover:opacity-80 transition-opacity"
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "rgba(0,0,0,.6)",
            color: "#fff",
            fontSize: 12,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function AudioPreviewItem({ item, onRemove }: { item: PendingAttachment; onRemove: () => void }) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-[8px] border border-border"
      style={{ background: "var(--color-blue-dim)", maxWidth: 200 }}
    >
      <span className="text-blue text-[11px]">🎤</span>
      <span className="text-[11px] text-text-2 flex-1 truncate">
        {item.attachment.duration !== undefined ? `${item.attachment.duration}s` : "Áudio"}
      </span>
      {item.uploading ? (
        <span className="animate-spin w-3 h-3 border border-blue border-t-transparent rounded-full shrink-0" />
      ) : (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover áudio"
          className="text-text-3 hover:text-text-1 text-[12px] leading-none shrink-0"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Mention dropdown ─────────────────────────────────────────────────────────

interface MentionDropdownProps {
  items: { userId: string; label: string }[];
  onSelect: (label: string) => void;
  onClose: () => void;
}

function MentionDropdown({ items, onSelect, onClose }: MentionDropdownProps) {
  const [active, setActive] = useState(0);

  useEffect(() => { setActive(0); }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 z-50 rounded-[10px] overflow-hidden"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 4px 20px rgba(0,0,0,.15)",
      }}
    >
      {items.map((item, i) => (
        <button
          key={item.userId}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // prevent blur on textarea
            onSelect(item.label);
          }}
          onMouseEnter={() => setActive(i)}
          className={cn(
            "w-full flex items-center gap-[8px] px-[12px] py-[8px] text-left transition-colors",
            i === active
              ? "bg-[var(--color-blue-dim)]"
              : "hover:bg-[var(--color-bg-subtle)]"
          )}
        >
          <div
            className="w-[24px] h-[24px] rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ background: "var(--color-blue-dim)", color: "var(--color-blue-bright)" }}
          >
            {item.label.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-[13px] text-text-1">
            <span style={{ color: "var(--color-blue-bright)" }}>@</span>{item.label}
          </span>
        </button>
      ))}
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onClose(); }}
        className="sr-only"
      >
        Fechar
      </button>
    </div>
  );
}

// ─── InputArea ────────────────────────────────────────────────────────────────

export function InputArea({
  topicId: _topicId,
  topicTitle,
  communityId,
  onSendMessage,
  onMarkDecision,
  onRequestSummary,
  onTyping,
  disabled = false,
  getToken,
  replyTo,
  onCancelReply,
}: InputAreaProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  // ── Mention state ────────────────────────────────────────────────────────
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = closed
  const [mentionStart, setMentionStart] = useState(0); // cursor position of the @
  const members = useCommunityMembers(communityId, getToken);
  const mentionItems = mentionQuery === null ? [] : members
    .filter((m) => m.displayName)
    .map((m) => ({
      userId: m.userId,
      label: m.displayName as string,
    }))
    .filter((m) =>
      mentionQuery === "" || m.label.toLowerCase().startsWith(mentionQuery.toLowerCase())
    )
    .slice(0, 6);

  // Audio recording state
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const recordingStartRef = useRef<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isKlipMode = content.trim().toLowerCase().startsWith("@klip");
  const hasUploading = pendingAttachments.some((a) => a.uploading);
  const canSend =
    (content.trim().length > 0 || pendingAttachments.some((a) => !a.uploading && !a.error)) &&
    !isSending &&
    !disabled &&
    !hasUploading &&
    !recording;

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      pendingAttachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-expand textarea ────────────────────────────────────────────────
  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  // ── Mention detection ────────────────────────────────────────────────────
  const handleContentChange = useCallback((newValue: string, cursorPos: number) => {
    // Look back from cursor to find a @ that started a mention
    const textBefore = newValue.slice(0, cursorPos);
    const atMatch = textBefore.match(/@([\w.]*)$/);
    if (atMatch && atMatch.index !== undefined) {
      setMentionStart(atMatch.index);
      setMentionQuery(atMatch[1] ?? "");
    } else {
      setMentionQuery(null);
    }
  }, []);

  const handleMentionSelect = useCallback((label: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const before = content.slice(0, mentionStart);
    const after = content.slice(ta.selectionEnd);
    const inserted = `@${label} `;
    const next = before + inserted + after;
    setContent(next);
    setMentionQuery(null);
    // Move cursor after inserted text
    setTimeout(() => {
      const pos = (before + inserted).length;
      ta.setSelectionRange(pos, pos);
      ta.focus();
    }, 0);
  }, [content, mentionStart]);

  // ── Upload helper ────────────────────────────────────────────────────────
  async function uploadFile(file: File, pendingId: string): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);

    const token = getToken ? await getToken() : null;
    const res = await fetch(`${API_URL}/api/uploads`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setPendingAttachments((prev) =>
        prev.map((a) =>
          a.id === pendingId
            ? { ...a, uploading: false, error: body.error ?? "Erro no upload" }
            : a
        )
      );
      return;
    }

    const data = await res.json() as Omit<Attachment, "duration">;
    setPendingAttachments((prev) =>
      prev.map((a) =>
        a.id === pendingId
          ? { ...a, uploading: false, attachment: { ...a.attachment, ...data } }
          : a
      )
    );
  }

  // ── Image picker ─────────────────────────────────────────────────────────
  function handleImageButtonClick() {
    imageInputRef.current?.click();
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    for (const file of files) {
      const pendingId = `pending-${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(file);

      const pending: PendingAttachment = {
        id: pendingId,
        previewUrl,
        uploading: true,
        attachment: { type: "image", url: "", name: file.name, size: file.size },
      };

      setPendingAttachments((prev) => [...prev, pending]);
      void uploadFile(file, pendingId);
    }

    // Reset so the same file can be re-selected after removal
    e.target.value = "";
  }

  // ── Audio recording ──────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        const durationSecs = Math.round((Date.now() - recordingStartRef.current) / 1000);
        const file = new File([blob], `audio-${Date.now()}.${mimeType.split("/")[1]}`, { type: mimeType });
        const previewUrl = URL.createObjectURL(blob);
        const pendingId = `pending-audio-${Date.now()}`;

        const pending: PendingAttachment = {
          id: pendingId,
          previewUrl,
          uploading: true,
          attachment: { type: "audio", url: "", name: file.name, size: file.size, duration: durationSecs },
        };

        setPendingAttachments((prev) => [...prev, pending]);
        void uploadFile(file, pendingId);
      };

      mr.start();
      recorderRef.current = mr;
      recordingStartRef.current = Date.now();
      setRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      // Microphone permission denied or not available
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  function handleMicButton() {
    if (recording) stopRecording();
    else void startRecording();
  }

  // ── Remove attachment ────────────────────────────────────────────────────
  function removeAttachment(id: string) {
    setPendingAttachments((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }

  // ── Send ─────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const trimmed = content.trim();
    const attachments = pendingAttachments
      .filter((a) => !a.uploading && !a.error)
      .map((a) => a.attachment);

    setIsSending(true);
    try {
      await onSendMessage(trimmed, attachments, replyTo ?? undefined);
      setContent("");
      setPendingAttachments([]);
      onCancelReply?.();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  }, [canSend, content, pendingAttachments, replyTo, onSendMessage, onCancelReply]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Escape closes mention dropdown
      if (e.key === "Escape" && mentionQuery !== null) {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
      // Enter/Tab selects first mention item
      if ((e.key === "Enter" || e.key === "Tab") && mentionQuery !== null && mentionItems.length > 0) {
        e.preventDefault();
        handleMentionSelect(mentionItems[0]!.label);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend, mentionQuery, mentionItems, handleMentionSelect]
  );

  const formatTimer = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div
      className="flex flex-col gap-2 px-5 py-3 shrink-0"
      style={{
        background: "var(--color-bg-surface)",
        borderTop: "1px solid var(--color-border)",
        boxShadow: "0 -4px 20px rgba(0,0,0,.3)",
      }}
    >
      {/* ── Attachment previews — acima do pill ──────────────────────── */}
      {pendingAttachments.length > 0 && (
        <div
          className="flex items-center gap-2 flex-wrap p-2 rounded-[10px]"
          style={{ background: "rgba(74,158,255,.06)" }}
        >
          {pendingAttachments.map((item) =>
            item.attachment.type === "image" ? (
              <ImagePreviewItem key={item.id} item={item} onRemove={() => removeAttachment(item.id)} />
            ) : (
              <AudioPreviewItem key={item.id} item={item} onRemove={() => removeAttachment(item.id)} />
            )
          )}
        </div>
      )}

      {/* ── Recording indicator ──────────────────────────────────────── */}
      {recording && (
        <div className="flex items-center gap-2 text-[12px] text-red-500">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>Gravando… {formatTimer(recordingSeconds)}</span>
        </div>
      )}

      {/* ── Context pill ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-[6px]">
        {replyTo ? (
          <div
            className="inline-flex items-center gap-[6px] px-[10px] py-[3px] rounded-[20px] text-[11px] font-medium transition-colors flex-1 min-w-0"
            style={{
              color: "var(--color-blue)",
              background: "var(--color-blue-dim)",
              border: "1px solid var(--color-blue-border)",
            }}
          >
            <span className="leading-none shrink-0">↩</span>
            <span className="truncate">
              Respondendo a: <strong>{replyTo.authorName}</strong>
              {" — "}
              <span style={{ opacity: 0.7 }}>
                &ldquo;{replyTo.content.slice(0, 30)}{replyTo.content.length > 30 ? "…" : ""}&rdquo;
              </span>
            </span>
            <button
              type="button"
              onClick={onCancelReply}
              aria-label="Cancelar resposta"
              className="shrink-0 leading-none hover:opacity-60 transition-opacity ml-[2px]"
              style={{ fontSize: 14, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        ) : (
          <div
            className="inline-flex items-center gap-[5px] px-[10px] py-[2px] rounded-[20px] text-[11px] font-medium transition-colors"
            style={{
              color: "var(--color-pill-text)",
              background: "var(--color-blue-dim)",
              border: isKlipMode ? "1px solid var(--color-blue)" : "1px solid var(--color-pill-border)",
            }}
          >
            <span className="font-semibold leading-none">+</span>
            <span>Respondendo em: {topicTitle}</span>
            {isKlipMode && <span className="font-semibold ml-[2px]">@klip</span>}
          </div>
        )}
      </div>

      {/* ── Textarea + send button ────────────────────────────────────── */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
        {mentionQuery !== null && mentionItems.length > 0 && (
          <MentionDropdown
            items={mentionItems}
            onSelect={handleMentionSelect}
            onClose={() => setMentionQuery(null)}
          />
        )}
        <textarea
          ref={textareaRef}
          data-input-textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            onTyping?.();
            handleContentChange(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => { setIsFocused(false); setTimeout(() => setMentionQuery(null), 150); }}
          placeholder="Escreva uma mensagem… ou @klip para resumir"
          aria-label="Campo de mensagem"
          disabled={disabled || recording}
          rows={1}
          className={cn(
            "w-full text-[13.5px] text-text-1 rounded-[12px] px-[14px] py-[10px]",
            "resize-none outline-none transition-all duration-200",
            "placeholder:text-text-3 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          style={{
            background: isFocused ? "var(--color-input-bg-focus)" : "var(--color-input-bg)",
            border: isFocused ? "1.5px solid var(--color-input-border-focus)" : "1.5px solid var(--color-input-border)",
            boxShadow: isFocused ? "0 0 0 3px var(--color-blue-glow)" : "none",
            minHeight: 42,
            maxHeight: 120,
          }}
        />
        </div>

        <button
          type="button"
          aria-label="Enviar mensagem"
          disabled={!canSend}
          onClick={() => void handleSend()}
          className={cn(
            "w-[40px] h-[40px] rounded-[11px] flex items-center justify-center shrink-0",
            "bg-blue text-white transition-all",
            canSend ? "hover:brightness-125 cursor-pointer" : "opacity-35 cursor-not-allowed"
          )}
          style={{ boxShadow: canSend ? "0 2px 12px var(--color-blue-glow)" : "none" }}
        >
          {isSending ? (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.8" strokeDasharray="20 15" strokeLinecap="round" />
            </svg>
          ) : (
            <SendIcon />
          )}
        </button>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div role="toolbar" aria-label="Ferramentas da mensagem" className="flex items-center gap-[4px]">

        {/* Group 1: Media (Imagem + Áudio) */}
        <button
          type="button"
          onClick={handleImageButtonClick}
          disabled={disabled || recording}
          className="inline-flex items-center gap-[4px] text-[11px] font-medium px-[8px] py-[4px] rounded-[6px] transition-colors leading-none disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(255,255,255,.06)]"
          style={{
            color: "#6B8BAF",
            border: "none",
            background: "transparent",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <rect x="1" y="1" width="12" height="12" rx="2" />
            <circle cx="4.5" cy="4.5" r="1.2" fill="currentColor" stroke="none" />
            <path d="M13 9l-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Imagem
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          capture={undefined}
          style={{ display: "none" }}
          onChange={handleImageSelect}
          aria-hidden="true"
        />

        <button
          type="button"
          onClick={handleMicButton}
          disabled={disabled}
          className="inline-flex items-center gap-[4px] text-[11px] font-medium px-[8px] py-[4px] rounded-[6px] transition-colors leading-none disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(255,255,255,.06)]"
          style={recording ? {
            color: "#ef4444",
            border: "none",
            background: "rgba(239,68,68,.08)",
          } : {
            color: "#6B8BAF",
            border: "none",
            background: "transparent",
          }}
        >
          {recording ? <StopIcon /> : (
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <rect x="4" y="1" width="6" height="8" rx="3" />
              <path d="M2 8c0 2.8 2.2 5 5 5s5-2.2 5-5" strokeLinecap="round" />
              <path d="M7 13v1.5" strokeLinecap="round" />
            </svg>
          )}
          {recording ? `Parar ${formatTimer(recordingSeconds)}` : "Áudio"}
        </button>

        {/* Separator */}
        <span className="w-px h-[18px] bg-border mx-[4px] shrink-0" />

        {/* Group 2: Decision + Poll */}
        <ToolbarButton icon={<DecisionIcon />} label="Decisão" onClick={onMarkDecision} disabled={disabled} />
        <ToolbarButton
          icon={
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M2 12l4-4 3 3 3-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          label="Votação"
          onClick={() => {/* TODO fase 4 */}}
          disabled={disabled}
        />

        {/* Separator */}
        <span className="w-px h-[18px] bg-border mx-[4px] shrink-0" />

        {/* Group 3: AI */}
        <ToolbarButton icon={<SparkleIcon />} label="@klip resumir" onClick={onRequestSummary} variant="klip" disabled={disabled} />
      </div>
    </div>
  );
}

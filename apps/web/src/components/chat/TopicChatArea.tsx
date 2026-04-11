"use client";
import { VoiceToast } from "@/components/voice/VoiceToast";
import { VoiceSessionBar } from "@/components/voice/VoiceSessionBar";
import { useVoiceSession } from "@/hooks/useVoiceSession";

import { useState, useRef, useCallback, useEffect } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { MessageFeed, type Message } from "@/components/chat/MessageFeed";
import { InputArea, type ReplyTarget } from "@/components/chat/InputArea";
import {
  useTopicSocket,
  type MessageWithAuthor,
  type TypingUser,
  type TopicSummary,
  type Attachment,
} from "@/hooks/useTopicSocket";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TopicChatAreaProps {
  topicId: string;
  topicTitle: string;
  communityId?: string;
  initialMessages?: Message[];
  initialSummary?: TopicSummary | null;
  /** Callback so TopicHeader can show the connection indicator */
  onConnectionChange?: (connected: boolean) => void;
  /** Called once on mount with imperative handlers */
  onMount?: (handlers: { requestSummary: () => Promise<void> }) => void;
  /** Called whenever the summary changes (API response or socket push) */
  onSummaryChange?: (s: TopicSummary | null) => void;
  isAdmin?: boolean;
  canSave?: boolean;
  onPin?: (msg: Message) => void;
  highlightedMessageId?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFeedMessage(m: MessageWithAuthor): Message {
  return {
    id: m.id,
    topicId: m.topicId,
    authorId: m.authorId,
    content: m.content,
    isEdited: m.isEdited,
    isKlipped: m.isKlipped,
    attachments: m.attachments,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    deletedAt: m.deletedAt,
    author: { id: m.authorId, name: m.authorName },
    replyToId: m.replyToId ?? null,
    replyToAuthorName: m.replyToAuthorName ?? null,
    replyToContent: m.replyToContent ?? null,
  };
}

// ─── Inner component (no Clerk hooks) ────────────────────────────────────────

type TopicChatAreaInnerProps = TopicChatAreaProps & {
  userId: string;
  userName: string;
  getToken?: () => Promise<string | null>;
}


function TopicChatAreaInner({
  topicId,
  topicTitle,
  communityId,
  initialMessages = [],
  initialSummary,
  onConnectionChange,
  onMount,
  onSummaryChange,
  isAdmin,
  canSave,
  onPin,
  highlightedMessageId,
  userId,
  userName,
  getToken,
}: TopicChatAreaInnerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [summary, setSummary] = useState<TopicSummary | null>(initialSummary ?? null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [klipThinking, setKlipThinking] = useState(false);
  const [privateKlipResponse, setPrivateKlipResponse] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Typing debounce ────────────────────────────────────────────────────────
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Socket callbacks ───────────────────────────────────────────────────────

  const handleMessageNew = useCallback(
    (msg: MessageWithAuthor & { tempId?: string }) => {
      setMessages((prev) => {
        // Replace optimistic placeholder when server confirms
        if (msg.tempId) {
          const idx = prev.findIndex((m) => m.id === msg.tempId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = toFeedMessage(msg);
            return next;
          }
        }
        // Deduplicate by real id (e.g. own message broadcast back to sender)
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, toFeedMessage(msg)];
      });
    },
    []
  );

  const handleMessageDeleted = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, deletedAt: new Date() } : m
      )
    );
  }, []);

  const handleTypingUpdate = useCallback((users: TypingUser[]) => {
    setTypingUsers(users);
  }, []);

  const handleSummaryUpdated = useCallback((s: TopicSummary) => {
    setSummary(s);
  }, []);

  // ── Voice session ──────────────────────────────────────────────────────────

  const getTokenSafe = getToken ?? (() => Promise.resolve(null))
  const {
    isConnected: voiceConnected,
    isHost: isVoiceHost,
    isMuted,
    isSpeaking,
    participants,
    handRaised,
    participantCount,
    joinSession,
    leaveSession,
    toggleMute,
    raiseHand,
  } = useVoiceSession(topicId, userId, getTokenSafe)

  const [voiceToast, setVoiceToast] = useState<{ hostName: string; topicName: string } | null>(null)

  const handleVoiceStarted = useCallback(
    ({ hostName }: { sessionId: string; hostName: string; hostClerkId: string }) => {
      // Show toast only to users not already in the session
      setVoiceToast((prev) => prev ?? { hostName, topicName: topicTitle })
    },
    [topicTitle]
  )

  const handleVoiceEnded = useCallback(() => {
    setVoiceToast(null)
  }, [])

  // ── Socket hook ────────────────────────────────────────────────────────────

  const { isConnected, sendMessage, startTyping, stopTyping } = useTopicSocket({
    topicId,
    ...(getToken !== undefined ? { getToken } : {}),
    onMessageNew: handleMessageNew,
    onMessageDeleted: handleMessageDeleted,
    onTypingUpdate: handleTypingUpdate,
    onSummaryUpdated: handleSummaryUpdated,
    onVoiceStarted: handleVoiceStarted,
    onVoiceEnded: handleVoiceEnded,
  });

  // Propagate connection state to parent — useEffect prevents updating parent during render
  useEffect(() => {
    onConnectionChange?.(isConnected);
  }, [isConnected, onConnectionChange]);

  // ── InputArea handlers ─────────────────────────────────────────────────────

  const handleReply = useCallback((msg: Message) => {
    setReplyTo({
      messageId: msg.id,
      authorName: msg.author.name,
      content: msg.content,
    });
    // Focus the textarea — it may be accessed via a forwarded ref on InputArea
    // We use a small timeout so the state update renders first
    setTimeout(() => {
      const ta = document.querySelector<HTMLTextAreaElement>("[data-input-textarea]");
      ta?.focus();
    }, 50);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, attachments: Attachment[], reply?: ReplyTarget) => {
      if (!content.trim() && attachments.length === 0) return;

      const replyPayload = reply
        ? { replyToId: reply.messageId, replyToAuthorName: reply.authorName, replyToContent: reply.content.slice(0, 200) }
        : undefined;

      const tempId = sendMessage(content, attachments, replyPayload);

      const optimistic: Message = {
        id: tempId,
        topicId,
        authorId: userId,
        content,
        isEdited: false,
        isKlipped: false,
        attachments,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        author: { id: userId, name: userName },
        ...(reply ? {
          replyToId: reply.messageId,
          replyToAuthorName: reply.authorName,
          replyToContent: reply.content.slice(0, 200),
        } : {}),
      };
      setMessages((prev) => [...prev, optimistic]);
    },
    [topicId, userId, userName, sendMessage]
  );

  const handleTyping = useCallback(() => {
    startTyping();
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 2000);
  }, [startTyping, stopTyping]);

  const handleKlipMessage = useCallback(
    async (messageId: string) => {
      const token = getToken ? await getToken() : null;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/klips`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ messageId }),
          }
        );
        if (!res.ok) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isKlipped: true } : m))
        );
      } catch {
        // non-fatal
      }
    },
    [getToken]
  );

  const handleMarkDecision = useCallback(() => {
    // TODO: decisões — fase 4
  }, []);

  const handleRequestSummary = useCallback(async () => {
    const token = getToken ? await getToken() : null;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/ai/summary`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ topicId }),
        }
      );
      if (!res.ok) return;
      const data = await res.json() as { content: string; createdAt: string };
      setSummary({
        content: data.content,
        decisions: [],
        generatedAt: new Date(data.createdAt),
      });
    } catch {
      // non-fatal
    }
  }, [topicId, getToken]);

  const handleKlipCommand = useCallback(
    async ({ command, isPrivate }: { command: string; isPrivate: boolean }) => {
      setKlipThinking(true);
      try {
        const token = getToken ? await getToken() : null;
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/topics/${topicId}/klip-command`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ command, isPrivate }),
          }
        );
        if (!res.ok) return;
        const data = await res.json() as { response: string; messageId?: string };
        if (isPrivate) {
          setPrivateKlipResponse(data.response);
        }
        // Public response: broadcast via Socket.io — message appears through handleMessageNew
      } catch {
        // non-fatal
      } finally {
        setKlipThinking(false);
      }
    },
    [topicId, getToken]
  );

  // Register imperative handlers with parent on mount
  const onMountRef = useRef(onMount);
  useEffect(() => {
    onMountRef.current?.({ requestSummary: handleRequestSummary });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Propagate summary changes to parent
  useEffect(() => {
    onSummaryChange?.(summary);
  }, [summary, onSummaryChange]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <VoiceSessionBar
        isConnected={voiceConnected}
        isMuted={isMuted}
        isSpeaking={isSpeaking}
        participants={participants}
        handRaised={handRaised}
        participantCount={participantCount}
        isHost={isVoiceHost}
        userName={userName}
        onLeave={() => void leaveSession()}
        onToggleMute={() => void toggleMute()}
        onRaiseHand={() => void raiseHand(userName)}
      />
      {voiceToast && !voiceConnected && (
        <VoiceToast
          hostName={voiceToast.hostName}
          topicName={topicTitle}
          onJoin={async () => {
            setVoiceToast(null)
            try { await joinSession() } catch { /* non-fatal — user already sees the bar if succeeded */ }
          }}
          onDismiss={() => setVoiceToast(null)}
        />
      )}
      <MessageFeed
        messages={messages}
        currentUserId={userId}
        topicSummary={summary}
        typingUsers={typingUsers.map((u) => ({ userId: u.userId, name: u.name }))}
        onKlipMessage={handleKlipMessage}
        onReply={handleReply}
        isAdmin={isAdmin ?? false}
        canSave={canSave ?? false}
        klipThinking={klipThinking}
        {...(privateKlipResponse ? { privateKlipResponse } : {})}
        onClearPrivateResponse={() => setPrivateKlipResponse(null)}
        {...(onPin ? { onPin } : {})}
        {...(highlightedMessageId ? { highlightedMessageId } : {})}
      />
      <InputArea
        topicId={topicId}
        topicTitle={topicTitle}
        {...(communityId ? { communityId } : {})}
        onSendMessage={handleSendMessage}
        onMarkDecision={handleMarkDecision}
        onRequestSummary={handleRequestSummary}
        onKlipCommand={handleKlipCommand}
        onTyping={handleTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        isAdmin={isAdmin ?? false}
        {...(getToken !== undefined ? { getToken } : {})}
      />
    </div>
  );
}

// ─── With-Clerk wrapper (only rendered when Clerk is configured) ──────────────

function TopicChatAreaWithClerk(props: TopicChatAreaProps) {
  const { user } = useUser();
  const { getToken } = useAuth();

  return (
    <TopicChatAreaInner
      {...props}
      userId={user?.id ?? "me"}
      userName={user?.fullName ?? "Você"}
      getToken={getToken}
    />
  );
}

// ─── TopicChatArea — public export ───────────────────────────────────────────

export function TopicChatArea(props: TopicChatAreaProps) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <TopicChatAreaInner
        {...props}
        userId="dev-user"
        userName="Dev User"
      />
    );
  }
  return <TopicChatAreaWithClerk {...props} />;
}

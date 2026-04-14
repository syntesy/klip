"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

// ─── Shared event types (mirrored from apps/api/src/socket/index.ts) ──────────

export interface Attachment {
  type: "image" | "audio";
  url: string;
  name: string;
  size: number;
  duration?: number;
}

export interface MessageWithAuthor {
  id: string;
  topicId: string;
  authorId: string;
  authorName: string;
  content: string;
  isEdited: boolean;
  isKlipped: boolean;
  isDecision: boolean;
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  replyToId?: string | null;
  replyToAuthorName?: string | null;
  replyToContent?: string | null;
  /** Present on broadcast — identifies the optimistic message to replace */
  tempId?: string;
}

export interface TypingUser {
  userId: string;
  name: string;
}

export interface TopicSummary {
  content: string;
  decisions: string[];
  generatedAt: Date;
}

// ─── Event maps ───────────────────────────────────────────────────────────────

interface ClientToServerEvents {
  "topic:join": (topicId: string) => void;
  "topic:leave": (topicId: string) => void;
  "message:send": (payload: {
    topicId: string;
    content: string;
    tempId: string;
    attachments?: Attachment[];
    replyToId?: string;
    replyToAuthorName?: string;
    replyToContent?: string;
    isDecision?: boolean;
  }) => void;
  "typing:start": (topicId: string) => void;
  "typing:stop": (topicId: string) => void;
}

interface ServerToClientEvents {
  "message:new": (message: MessageWithAuthor & { tempId?: string }) => void;
  "message:deleted": (messageId: string) => void;
  "typing:update": (users: TypingUser[]) => void;
  "summary:updated": (summary: TopicSummary) => void;
  "topic:stats": (stats: { messageCount: number }) => void;
  "voice:started": (payload: { sessionId: string; hostName: string; hostClerkId: string }) => void;
  "voice:ended": (payload: { sessionId: string }) => void;
  "album:published": (payload: { albumId: string; topicId: string | null | undefined; album: Record<string, unknown> }) => void;
  "album:purchased": (payload: { albumId: string; photos: Record<string, unknown>[] }) => void;
  error: (err: { code: string; message: string }) => void;
}

// ─── Hook props ───────────────────────────────────────────────────────────────

interface UseTopicSocketProps {
  topicId: string;
  /** Returns a JWT for socket auth. Pass `undefined` to skip auth (dev without Clerk). */
  getToken?: () => Promise<string | null>;
  onMessageNew: (message: MessageWithAuthor & { tempId?: string }) => void;
  onMessageDeleted: (messageId: string) => void;
  onTypingUpdate: (users: TypingUser[]) => void;
  onSummaryUpdated: (summary: TopicSummary) => void;
  onVoiceStarted?: (payload: { sessionId: string; hostName: string; hostClerkId: string }) => void;
  onVoiceEnded?: (payload: { sessionId: string }) => void;
  onAlbumPublished?: (payload: { albumId: string; topicId: string | null | undefined; album: Record<string, unknown> }) => void;
  onAlbumPurchased?: (payload: { albumId: string; photos: Record<string, unknown>[] }) => void;
}

// ─── useTopicSocket ───────────────────────────────────────────────────────────

export function useTopicSocket({
  topicId,
  getToken,
  onMessageNew,
  onMessageDeleted,
  onTypingUpdate,
  onSummaryUpdated,
  onVoiceStarted,
  onVoiceEnded,
  onAlbumPublished,
  onAlbumPurchased,
}: UseTopicSocketProps) {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Keep callbacks in refs so the effect closure is never stale
  const onMessageNewRef = useRef(onMessageNew);
  const onMessageDeletedRef = useRef(onMessageDeleted);
  const onTypingUpdateRef = useRef(onTypingUpdate);
  const onSummaryUpdatedRef = useRef(onSummaryUpdated);
  const onVoiceStartedRef = useRef(onVoiceStarted);
  const onVoiceEndedRef = useRef(onVoiceEnded);
  const onAlbumPublishedRef = useRef(onAlbumPublished);
  const onAlbumPurchasedRef = useRef(onAlbumPurchased);

  useEffect(() => { onMessageNewRef.current = onMessageNew; }, [onMessageNew]);
  useEffect(() => { onMessageDeletedRef.current = onMessageDeleted; }, [onMessageDeleted]);
  useEffect(() => { onTypingUpdateRef.current = onTypingUpdate; }, [onTypingUpdate]);
  useEffect(() => { onSummaryUpdatedRef.current = onSummaryUpdated; }, [onSummaryUpdated]);
  useEffect(() => { onVoiceStartedRef.current = onVoiceStarted; }, [onVoiceStarted]);
  useEffect(() => { onVoiceEndedRef.current = onVoiceEnded; }, [onVoiceEnded]);
  useEffect(() => { onAlbumPublishedRef.current = onAlbumPublished; }, [onAlbumPublished]);
  useEffect(() => { onAlbumPurchasedRef.current = onAlbumPurchased; }, [onAlbumPurchased]);

  useEffect(() => {
    let socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    let active = true;

    async function connect() {
      const token = getToken ? await getToken() : null;

      if (!active) return; // component unmounted while awaiting token

      socket = io(process.env.NEXT_PUBLIC_API_URL!, {
        auth: { token },
        transports: ["websocket"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1500,
      });

      socket.on("connect", () => {
        setIsConnected(true);
        socket.emit("topic:join", topicId);
      });

      socket.on("disconnect", () => setIsConnected(false));

      socket.on("message:new", (msg) => {
        // Dates arrive as strings over the wire — rehydrate
        onMessageNewRef.current({
          ...msg,
          createdAt: new Date(msg.createdAt),
          updatedAt: new Date(msg.updatedAt),
          deletedAt: msg.deletedAt ? new Date(msg.deletedAt) : null,
        });
      });

      socket.on("message:deleted", (id) => onMessageDeletedRef.current(id));
      socket.on("typing:update", (users) => onTypingUpdateRef.current(users));
      socket.on("summary:updated", (s) => {
        onSummaryUpdatedRef.current({
          ...s,
          generatedAt: new Date(s.generatedAt),
        });
      });
      socket.on("voice:started", (payload) => onVoiceStartedRef.current?.(payload));
      socket.on("voice:ended", (payload) => onVoiceEndedRef.current?.(payload));
      socket.on("album:published", (payload) => onAlbumPublishedRef.current?.(payload));
      socket.on("album:purchased", (payload) => onAlbumPurchasedRef.current?.(payload));

      socketRef.current = socket;
    }

    void connect();

    return () => {
      active = false;
      if (socket) {
        socket.emit("topic:leave", topicId);
        socket.disconnect();
      }
    };
  }, [topicId]); // reconnect when topic changes — getToken is stable per Clerk docs

  // ── Actions ─────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (
      content: string,
      attachments?: Attachment[],
      replyTo?: { replyToId: string; replyToAuthorName: string; replyToContent: string },
      isDecision?: boolean
    ): string => {
      const tempId = `optimistic-${Date.now()}-${Math.random()}`;
      socketRef.current?.emit("message:send", {
        topicId,
        content,
        tempId,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
        ...(replyTo ?? {}),
        ...(isDecision ? { isDecision: true } : {}),
      });
      return tempId;
    },
    [topicId]
  );

  const startTyping = useCallback(() => {
    socketRef.current?.emit("typing:start", topicId);
  }, [topicId]);

  const stopTyping = useCallback(() => {
    socketRef.current?.emit("typing:stop", topicId);
  }, [topicId]);

  return { isConnected, sendMessage, startTyping, stopTyping };
}

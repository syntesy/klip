import type { Server, Socket } from "socket.io";
import { verifyToken } from "@clerk/backend";
import { setIo } from "../lib/io.js";
import { db } from "../lib/db.js";
import { messages, topics, communityMembers, notifications } from "@klip/db/schema";
import type { Attachment } from "@klip/db/schema";
import { eq, sql, and } from "drizzle-orm";

// ─── Shared types (mirrored in web/src/hooks/useTopicSocket.ts) ───────────────

export interface MessageWithAuthor {
  id: string;
  topicId: string;
  authorId: string;
  authorName: string;
  content: string;
  isEdited: boolean;
  isKlipped: boolean;
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  replyToId?: string | null;
  replyToAuthorName?: string | null;
  replyToContent?: string | null;
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

export interface ClientToServerEvents {
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
  }) => void;
  "typing:start": (topicId: string) => void;
  "typing:stop": (topicId: string) => void;
}

export interface ServerToClientEvents {
  "message:new": (message: MessageWithAuthor & { tempId?: string }) => void;
  "message:deleted": (messageId: string) => void;
  "typing:update": (users: TypingUser[]) => void;
  "summary:updated": (summary: TopicSummary) => void;
  "topic:stats": (stats: { messageCount: number }) => void;
  "error": (err: { code: string; message: string }) => void;
  // Voice
  "voice:started": (payload: { sessionId: string; hostName: string; hostClerkId: string }) => void;
  "voice:ended": (payload: { sessionId: string }) => void;
  "voice:hand-raised": (payload: { clerkUserId: string; userName: string; sessionId: string }) => void;
  "voice:speak-granted": (payload: { sessionId: string }) => void;
  "notification:new": (payload: { notification: Record<string, unknown> }) => void;
}

export interface SocketData {
  userId: string;
  name: string;
}

type KlipSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type KlipServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// ─── Auth middleware ──────────────────────────────────────────────────────────

export function setupSocketAuth(io: KlipServer): void {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth["token"] as string | undefined;

    if (!token) {
      next(new Error("unauthorized"));
      return;
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY ?? "",
      });
      socket.data.userId = payload.sub;
      // Clerk token may include name via session claims; fallback to "Usuário"
      socket.data.name =
        (payload as Record<string, unknown>)["name"] as string | undefined
        ?? "Usuário";
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
}

// ─── Typing state ─────────────────────────────────────────────────────────────

const TYPING_TTL_MS = 10_000; // auto-expire after 10s if no typing:stop received
const TYPING_CLEANUP_INTERVAL_MS = 5_000;

// Internal entry includes TTL; only TypingUser fields are broadcast to clients
interface TypingEntry extends TypingUser {
  exp: number; // unix ms
}

// topicId → Map<userId, TypingEntry>
const typingState = new Map<string, Map<string, TypingEntry>>();

function broadcastTyping(io: KlipServer, topicId: string): void {
  const users: TypingUser[] = [];
  typingState.get(topicId)?.forEach(({ userId, name }) => users.push({ userId, name }));
  io.to(`topic:${topicId}`).emit("typing:update", users);
}

function clearTyping(io: KlipServer, topicId: string, userId: string): void {
  typingState.get(topicId)?.delete(userId);
  broadcastTyping(io, topicId);
}

// Periodically evict stale typing entries to prevent unbounded memory growth
// (e.g. clients that disconnect without sending typing:stop)
setInterval(() => {
  const now = Date.now();
  for (const [topicId, users] of typingState) {
    let changed = false;
    for (const [uid, entry] of users) {
      if (entry.exp < now) {
        users.delete(uid);
        changed = true;
      }
    }
    if (users.size === 0) {
      typingState.delete(topicId);
    } else if (changed) {
      // Re-broadcast so clients clear the stale "X is typing" indicator
      // io is not in scope here — we store a reference via module-level var
      _io?.to(`topic:${topicId}`).emit(
        "typing:update",
        Array.from(users.values()).map(({ userId, name }) => ({ userId, name }))
      );
    }
  }
}, TYPING_CLEANUP_INTERVAL_MS).unref(); // unref so the interval doesn't keep the process alive

// Module-level io reference for use inside the cleanup interval
let _io: KlipServer | null = null;

// ─── Event handlers ───────────────────────────────────────────────────────────

export function registerSocketHandlers(io: KlipServer): void {
  _io = io;
  setIo(io);
  setupSocketAuth(io);

  io.on("connection", (socket: KlipSocket) => {
    const { userId, name } = socket.data;

    // ── Room management ─────────────────────────────────────────────────────

    socket.on("topic:join", async (topicId) => {
      const [topic] = await db
        .select({ communityId: topics.communityId })
        .from(topics)
        .where(eq(topics.id, topicId))
        .limit(1);
      if (!topic) {
        socket.emit("error", { code: "not_found", message: "Tópico não encontrado" });
        return;
      }
      const [member] = await db
        .select({ id: communityMembers.id })
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, topic.communityId), eq(communityMembers.userId, userId)))
        .limit(1);
      if (!member) {
        socket.emit("error", { code: "forbidden", message: "Acesso negado" });
        return;
      }
      void socket.join(`topic:${topicId}`);
    });

    socket.on("topic:leave", (topicId) => {
      clearTyping(io, topicId, userId);
      void socket.leave(`topic:${topicId}`);
    });

    // ── Send message ────────────────────────────────────────────────────────

    socket.on("message:send", async ({ topicId, content, tempId, attachments, replyToId, replyToAuthorName, replyToContent }) => {
      if (!content?.trim() && (!attachments || attachments.length === 0)) return;
      if (!topicId) return;
      if (content && content.length > 4000) {
        socket.emit("error", { code: "too_long", message: "Mensagem muito longa (máx 4000 caracteres)" });
        return;
      }

      try {
        // Verify sender is a member of the topic's community
        const [topicForAuth] = await db
          .select({ communityId: topics.communityId })
          .from(topics)
          .where(eq(topics.id, topicId))
          .limit(1);
        if (!topicForAuth) {
          socket.emit("error", { code: "not_found", message: "Tópico não encontrado" });
          return;
        }
        const [membership] = await db
          .select({ id: communityMembers.id })
          .from(communityMembers)
          .where(and(eq(communityMembers.communityId, topicForAuth.communityId), eq(communityMembers.userId, userId)))
          .limit(1);
        if (!membership) {
          socket.emit("error", { code: "forbidden", message: "Você não é membro desta comunidade" });
          return;
        }

        // Persist
        const rows = await db
          .insert(messages)
          .values({
            topicId,
            authorId: userId,
            content: content.trim(),
            attachments: attachments ?? [],
            ...(replyToId ? { replyToId, replyToAuthorName, replyToContent } : {}),
          })
          .returning();
        const msg = rows[0];
        if (!msg) throw new Error("insert returned no rows");

        // Bump topic stats
        await db
          .update(topics)
          .set({
            messageCount: sql`${topics.messageCount} + 1`,
            lastActivityAt: new Date(),
          })
          .where(eq(topics.id, topicId));

        // Stop typing for this user
        clearTyping(io, topicId, userId);

        // Broadcast to the whole room (including sender for confirmation)
        const broadcast: MessageWithAuthor & { tempId: string } = {
          id: msg.id,
          topicId: msg.topicId,
          authorId: msg.authorId,
          authorName: name,
          content: msg.content,
          isEdited: msg.isEdited,
          isKlipped: false,
          attachments: (msg.attachments as Attachment[]) ?? [],
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
          deletedAt: msg.deletedAt ?? null,
          replyToId: msg.replyToId ?? null,
          replyToAuthorName: msg.replyToAuthorName ?? null,
          replyToContent: msg.replyToContent ?? null,
          tempId,
        };

        io.to(`topic:${topicId}`).emit("message:new", broadcast);

        // ── Mention notifications ──────────────────────────────────────────
        const mentionRegex = /@([\w.-]+)/g;
        const mentionedHandles = new Set<string>();
        let m: RegExpExecArray | null;
        while ((m = mentionRegex.exec(content)) !== null) {
          if (m[1] && m[1].toLowerCase() !== "klip") {
            mentionedHandles.add(m[1].toLowerCase());
          }
        }

        if (mentionedHandles.size > 0) {
          // Reuse communityId already fetched during auth check — no extra query
          const { communityId } = topicForAuth;

          const members = await db
            .select({ userId: communityMembers.userId, displayName: communityMembers.displayName })
            .from(communityMembers)
            .where(eq(communityMembers.communityId, communityId));

          // Build word→userId map for O(n) matching instead of O(n²) nested filter
          const wordToUser = new Map<string, string>();
          for (const mb of members) {
            if (!mb.displayName || mb.userId === userId) continue;
            for (const word of mb.displayName.toLowerCase().split(/\s+/)) {
              if (word) wordToUser.set(word, mb.userId);
            }
          }

          const recipientIds = new Set<string>();
          for (const handle of mentionedHandles) {
            for (const [word, uid] of wordToUser) {
              if (word === handle || word.startsWith(handle)) {
                recipientIds.add(uid);
              }
            }
          }

          if (recipientIds.size > 0) {
            const notifValues = [...recipientIds].map((recipientClerkId) => ({
              communityId,
              topicId,
              messageId: msg.id,
              recipientClerkId,
              type: "mention" as const,
            }));
            await db.insert(notifications).values(notifValues).onConflictDoNothing();
          }
        }
      } catch (err) {
        socket.emit("error", { code: "message_failed", message: "Falha ao enviar mensagem" });
      }
    });

    // ── Typing indicators ───────────────────────────────────────────────────

    socket.on("typing:start", (topicId) => {
      if (!typingState.has(topicId)) {
        typingState.set(topicId, new Map());
      }
      typingState.get(topicId)!.set(userId, { userId, name, exp: Date.now() + TYPING_TTL_MS });
      broadcastTyping(io, topicId);
    });

    socket.on("typing:stop", (topicId) => {
      clearTyping(io, topicId, userId);
    });

    // ── Disconnect ──────────────────────────────────────────────────────────

    socket.on("disconnect", () => {
      // Clean up typing state across all topics this socket was in
      typingState.forEach((users, topicId) => {
        if (users.has(userId)) {
          clearTyping(io, topicId, userId);
        }
      });
    });
  });
}

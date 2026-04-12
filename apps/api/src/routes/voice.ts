import type { FastifyInstance } from "fastify";
import { RoomServiceClient, AccessToken } from "livekit-server-sdk";
import { requireAuth } from "../plugins/auth.js";
import { getClerkDisplayName } from "../lib/clerkCache.js";
import { db } from "../lib/db.js";
import { tryEmit } from "../lib/io.js";
import { voiceSessions, communityMembers, topics } from "@klip/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

const grantSpeakSchema = z.object({
  participantIdentity: z.string().min(1),
});

const livekitUrl = process.env.LIVEKIT_URL ?? "";
const apiKey = process.env.LIVEKIT_API_KEY ?? "";
const apiSecret = process.env.LIVEKIT_API_SECRET ?? "";

const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);

export async function voiceRoutes(fastify: FastifyInstance) {
  // ── POST /api/topics/:topicId/voice/start (owner/mod only) ───────────────────
  fastify.post<{ Params: { topicId: string } }>(
    "/topics/:topicId/voice/start",
    { preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { topicId } = req.params;

      // Verify topic exists and get communityId
      const [topic] = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

      // Only owner/moderator
      const [member] = await db
        .select()
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, topic.communityId), eq(communityMembers.userId, req.userId)))
        .limit(1);
      if (!member) return reply.status(403).send({ error: "Access denied" });
      if (member.role !== "owner" && member.role !== "moderator") {
        return reply.status(403).send({ error: "Apenas owner/moderador pode iniciar áudio" });
      }

      // Check for existing active session — wrapped in a transaction with row-level
      // lock so concurrent start requests are serialised and cannot both succeed.
      const roomName = `klip-${topicId}`;
      const session = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: voiceSessions.id })
          .from(voiceSessions)
          .where(and(eq(voiceSessions.topicId, topicId), eq(voiceSessions.status, "active")))
          .for("update")
          .limit(1);
        if (existing) return null;

        const [inserted] = await tx.insert(voiceSessions).values({
          topicId,
          communityId: topic.communityId,
          hostClerkId: req.userId,
          livekitRoomName: roomName,
          status: "active",
        }).returning();
        return inserted ?? null;
      });

      if (!session) return reply.status(400).send({ error: "Sessão de voz já ativa" });

      // Create LiveKit room after DB session is committed.
      // If creation fails for a reason other than "room already exists",
      // mark the session ended so future /start calls aren't blocked.
      try {
        await roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 200 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const alreadyExists = msg.toLowerCase().includes("already exist") || msg.includes("409");
        if (!alreadyExists) {
          const e = err instanceof Error ? err : new Error(String(err));
          fastify.log.error({ message: e.message, name: e.name }, "LiveKit createRoom failed — ending DB session to unblock future /start");
          await db
            .update(voiceSessions)
            .set({ status: "ended", endedAt: new Date() })
            .where(eq(voiceSessions.id, session.id));
          return reply.status(503).send({ error: "Falha ao criar sala de voz. Tente novamente." });
        }
        fastify.log.warn({ message: (err instanceof Error ? err.message : String(err)) }, "LiveKit createRoom — room already exists, reusing");
      }

      // Host token (publish + subscribe) — 2h TTL
      const at = new AccessToken(apiKey, apiSecret, { identity: req.userId, ttl: '2h' });
      at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
      const token = await at.toJwt();

      // Resolve host display name (cached)
      const hostName = await getClerkDisplayName(req.userId);

      // Notify all topic members via socket — non-fatal if socket not ready
      tryEmit(`topic:${topicId}`, "voice:started", {
        sessionId: session.id,
        hostName,
        hostClerkId: req.userId,
      });

      return { sessionId: session.id, token, livekitUrl };
    }
  );

  // ── POST /api/topics/:topicId/voice/join ─────────────────────────────────────
  fastify.post<{ Params: { topicId: string } }>(
    "/topics/:topicId/voice/join",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { topicId } = req.params;

      const [topic] = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

      // Must be a member
      const [member] = await db
        .select()
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, topic.communityId), eq(communityMembers.userId, req.userId)))
        .limit(1);
      if (!member) return reply.status(403).send({ error: "Access denied" });

      const [session] = await db
        .select()
        .from(voiceSessions)
        .where(and(eq(voiceSessions.topicId, topicId), eq(voiceSessions.status, "active")))
        .limit(1);
      if (!session) return reply.status(404).send({ error: "Nenhuma sessão ativa" });

      // Listener token (subscribe only) — 2h TTL
      const at = new AccessToken(apiKey, apiSecret, { identity: req.userId, ttl: '2h' });
      at.addGrant({ roomJoin: true, room: session.livekitRoomName, canPublish: false, canSubscribe: true });
      const token = await at.toJwt();

      await db
        .update(voiceSessions)
        .set({ participantCount: sql`${voiceSessions.participantCount} + 1` })
        .where(eq(voiceSessions.id, session.id));

      return { token, livekitUrl, sessionId: session.id };
    }
  );

  // ── POST /api/voice/:sessionId/request-speak ─────────────────────────────────
  fastify.post<{ Params: { sessionId: string }; Body: { userName?: string } }>(
    "/voice/:sessionId/request-speak",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { sessionId } = req.params;

      const [session] = await db
        .select()
        .from(voiceSessions)
        .where(eq(voiceSessions.id, sessionId))
        .limit(1);
      if (!session) return reply.status(404).send({ error: "Sessão não encontrada" });

      // Verify requester is a member of the community
      const [topic] = await db.select({ communityId: topics.communityId }).from(topics).where(eq(topics.id, session.topicId)).limit(1);
      if (!topic) return reply.status(404).send({ error: "Tópico não encontrado" });

      const [member] = await db
        .select({ id: communityMembers.id })
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, topic.communityId), eq(communityMembers.userId, req.userId)))
        .limit(1);
      if (!member) return reply.status(403).send({ error: "Access denied" });

      const userName = await getClerkDisplayName(req.userId);

      tryEmit(`user:${session.hostClerkId}`, "voice:hand-raised", {
        clerkUserId: req.userId,
        userName,
        sessionId,
      });

      return { ok: true };
    }
  );

  // ── POST /api/voice/:sessionId/grant-speak ────────────────────────────────────
  fastify.post<{ Params: { sessionId: string }; Body: { participantIdentity: string } }>(
    "/voice/:sessionId/grant-speak",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { sessionId } = req.params;

      const parsed = grantSpeakSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const { participantIdentity } = parsed.data;

      const [session] = await db
        .select()
        .from(voiceSessions)
        .where(eq(voiceSessions.id, sessionId))
        .limit(1);
      if (!session) return reply.status(404).send({ error: "Sessão não encontrada" });

      // Only host can grant
      if (session.hostClerkId !== req.userId) return reply.status(403).send({ error: "Apenas o host pode aprovar" });

      await roomService.updateParticipant(session.livekitRoomName, participantIdentity, undefined, {
        canPublish: true,
        canSubscribe: true,
      });

      tryEmit(`user:${participantIdentity}`, "voice:speak-granted", { sessionId });

      return { ok: true };
    }
  );

  // ── POST /api/topics/:topicId/voice/leave ────────────────────────────────────
  fastify.post<{ Params: { topicId: string } }>(
    "/topics/:topicId/voice/leave",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { topicId } = req.params;

      // Verify community membership before allowing participant count changes
      const [topic] = await db.select({ communityId: topics.communityId }).from(topics).where(eq(topics.id, topicId)).limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

      const [member] = await db
        .select({ id: communityMembers.id })
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, topic.communityId), eq(communityMembers.userId, req.userId)))
        .limit(1);
      if (!member) return reply.status(403).send({ error: "Access denied" });

      const [session] = await db
        .select()
        .from(voiceSessions)
        .where(and(eq(voiceSessions.topicId, topicId), eq(voiceSessions.status, "active")))
        .limit(1);
      if (!session) return reply.status(404).send({ error: "Nenhuma sessão ativa" });

      // Decrement, floor at 0
      await db
        .update(voiceSessions)
        .set({ participantCount: sql`GREATEST(${voiceSessions.participantCount} - 1, 0)` })
        .where(eq(voiceSessions.id, session.id));

      return { ok: true };
    }
  );

  // ── POST /api/topics/:topicId/voice/end ──────────────────────────────────────
  fastify.post<{ Params: { topicId: string } }>(
    "/topics/:topicId/voice/end",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { topicId } = req.params;

      const [topic] = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

      const [member] = await db
        .select()
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, topic.communityId), eq(communityMembers.userId, req.userId)))
        .limit(1);
      if (!member || (member.role !== "owner" && member.role !== "moderator")) {
        return reply.status(403).send({ error: "Apenas owner/moderador pode encerrar" });
      }

      const [session] = await db
        .select()
        .from(voiceSessions)
        .where(and(eq(voiceSessions.topicId, topicId), eq(voiceSessions.status, "active")))
        .limit(1);
      if (!session) return reply.status(404).send({ error: "Nenhuma sessão ativa" });

      try {
        await roomService.deleteRoom(session.livekitRoomName);
      } catch (err) {
        fastify.log.warn({ message: (err instanceof Error ? err.message : String(err)) }, "deleteRoom failed — room may already be closed by LiveKit");
      }

      await db
        .update(voiceSessions)
        .set({ status: "ended", endedAt: new Date() })
        .where(eq(voiceSessions.id, session.id));

      tryEmit(`topic:${topicId}`, "voice:ended", { sessionId: session.id });

      return { ok: true };
    }
  );

  // ── GET /api/topics/:topicId/voice/active ────────────────────────────────────
  fastify.get<{ Params: { topicId: string } }>(
    "/topics/:topicId/voice/active",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { topicId } = req.params;

      // Verify membership before exposing session details
      const [topic] = await db.select({ communityId: topics.communityId }).from(topics).where(eq(topics.id, topicId)).limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

      const [member] = await db
        .select({ id: communityMembers.id })
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, topic.communityId), eq(communityMembers.userId, req.userId)))
        .limit(1);
      if (!member) return reply.status(403).send({ error: "Access denied" });

      const [session] = await db
        .select()
        .from(voiceSessions)
        .where(and(eq(voiceSessions.topicId, topicId), eq(voiceSessions.status, "active")))
        .limit(1);

      if (!session) return reply.send(null);
      return session;
    }
  );
}

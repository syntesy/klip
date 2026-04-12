import type { FastifyInstance } from "fastify";
import QRCode from "qrcode";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { communities, communityMembers } from "@klip/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createCommunitySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});

export async function communitiesRoutes(fastify: FastifyInstance) {
  // List communities the user belongs to
  fastify.get("/", { preHandler: requireAuth }, async (req, _reply) => {
    const rows = await db
      .select({ community: communities })
      .from(communityMembers)
      .innerJoin(communities, eq(communityMembers.communityId, communities.id))
      .where(eq(communityMembers.userId, req.userId));

    return rows.map((r) => r.community);
  });

  // Get single community — membership check first, then fetch
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const [member] = await db
        .select()
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, req.params.id),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!member) {
        return reply.status(403).send({ error: "Not a member" });
      }

      const [community] = await db
        .select()
        .from(communities)
        .where(eq(communities.id, req.params.id))
        .limit(1);

      if (!community) {
        return reply.status(404).send({ error: "Community not found" });
      }

      return community;
    }
  );

  // Get current user's membership in a community
  fastify.get<{ Params: { id: string } }>(
    "/:id/me",
    { preHandler: requireAuth },
    async (req, reply) => {
      const [member] = await db
        .select()
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, req.params.id),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!member) {
        return reply.status(404).send({ error: "Not a member" });
      }

      return { role: member.role, userId: member.userId, joinedAt: member.joinedAt };
    }
  );

  // List members of a community
  fastify.get<{ Params: { id: string } }>(
    "/:id/members",
    { preHandler: requireAuth },
    async (req, reply) => {
      // Must be a member to see other members
      const [self] = await db
        .select()
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, req.params.id),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!self) {
        return reply.status(403).send({ error: "Not a member" });
      }

      const rows = await db
        .select({
          userId: communityMembers.userId,
          role: communityMembers.role,
          joinedAt: communityMembers.joinedAt,
          displayName: communityMembers.displayName,
        })
        .from(communityMembers)
        .where(eq(communityMembers.communityId, req.params.id))
        .limit(500);

      return rows;
    }
  );

  // Create community — wrapped in a transaction so the community and its
  // owner membership are either both committed or both rolled back.
  fastify.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createCommunitySchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { name, slug, description } = parsed.data;

    try {
      const community = await db.transaction(async (tx) => {
        const [newCommunity] = await tx
          .insert(communities)
          .values({ name, slug, description, ownerId: req.userId })
          .returning();

        if (!newCommunity) throw new Error("insert returned no rows");

        // Add creator as owner member — inside the same transaction so the
        // two rows are guaranteed to be consistent even under failures.
        await tx.insert(communityMembers).values({
          communityId: newCommunity.id,
          userId: req.userId,
          role: "owner",
        });

        return newCommunity;
      });

      return reply.status(201).send(community);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const e = err instanceof Error ? err : new Error(String(err));
      fastify.log.error({ message: e.message, name: e.name }, "POST /api/communities failed");

      if (msg.includes("communities_slug_unique") || msg.includes("duplicate key")) {
        return reply.status(409).send({ error: "Esse slug já está em uso. Tente outro." });
      }
      return reply.status(500).send({ error: "Erro interno ao criar comunidade" });
    }
  });

  // Delete community — owner only; cascade handles members/topics via FK
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const [member] = await db
        .select()
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, req.params.id),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!member || member.role !== "owner") {
        return reply.status(403).send({ error: "Only the owner can delete this community" });
      }

      await db.delete(communities).where(eq(communities.id, req.params.id));
      return reply.status(204).send();
    }
  );

  // QR Code da comunidade
  fastify.get<{ Params: { id: string } }>(
    "/:id/qrcode",
    { preHandler: requireAuth },
    async (req, reply) => {
      // Membership check first — no point fetching the community if user can't access it
      const [member] = await db
        .select()
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, req.params.id),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!member) return reply.status(403).send({ error: "Access denied" });

      const [community] = await db
        .select({ id: communities.id, slug: communities.slug })
        .from(communities)
        .where(eq(communities.id, req.params.id))
        .limit(1);

      if (!community) return reply.status(404).send({ error: "Community not found" });

      const base =
        process.env.NODE_ENV === "production"
          ? (process.env.WEB_URL ?? "https://www.digitalklip.com")
          : (process.env.WEB_URL ?? "http://localhost:3000");
      const url = `${base}/convite/${community.slug}`;

      const svg = await QRCode.toString(url, { type: "svg", margin: 2, width: 200 });

      return { svg, url };
    }
  );
}

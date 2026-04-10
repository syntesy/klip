import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { requireAuth } from "../plugins/auth.js";
import { getClerkDisplayName } from "../lib/clerkCache.js";
import { db } from "../lib/db.js";
import { invites, communities, communityMembers } from "@klip/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { z } from "zod";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3002";

/** Generates a URL-safe random code of the given length */
function generateCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

const createInviteSchema = z.object({
  communityId: z.string().uuid(),
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive().optional(),
});

export async function invitesRoutes(fastify: FastifyInstance) {
  // ── POST /api/invites ─────────────────────────────────────────────────────
  // Creates a new invite link for a community (owner/moderator only)
  fastify.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { communityId, expiresAt, maxUses } = parsed.data;

    // Verify caller is a member with owner/moderator role
    const [member] = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, req.userId)
        )
      )
      .limit(1);

    if (!member || (member.role !== "owner" && member.role !== "moderator")) {
      return reply.status(403).send({ error: "Not authorized" });
    }

    // Look up the community to get its slug
    const [community] = await db
      .select({ slug: communities.slug })
      .from(communities)
      .where(eq(communities.id, communityId))
      .limit(1);

    if (!community) {
      return reply.status(404).send({ error: "Community not found" });
    }

    // Generate a unique random code (retry on collision — vanishingly rare)
    let code = generateCode(8);
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await db
        .select({ id: invites.id })
        .from(invites)
        .where(eq(invites.code, code))
        .limit(1);
      if (existing.length === 0) break;
      code = generateCode(8);
    }

    // Check if an active invite with this slug already exists; reuse it if so
    const [existingSlugInvite] = await db
      .select()
      .from(invites)
      .where(eq(invites.slug, community.slug))
      .limit(1);

    if (existingSlugInvite) {
      // Reuse the existing slug-based invite
      return reply.status(201).send({
        code: existingSlugInvite.code,
        slug: existingSlugInvite.slug,
        link: `${WEB_URL}/convite/${existingSlugInvite.slug}`,
      });
    }

    const [invite] = await db
      .insert(invites)
      .values({
        communityId,
        code,
        slug: community.slug,
        createdBy: req.userId,
        ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        ...(maxUses !== undefined ? { maxUses } : {}),
      })
      .returning();

    return reply.status(201).send({
      code: invite!.code,
      slug: invite!.slug,
      link: `${WEB_URL}/convite/${invite!.slug ?? invite!.code}`,
    });
  });

  // ── GET /api/invites/:code ────────────────────────────────────────────────
  // Public — returns community info so the accept page can render without auth
  fastify.get<{ Params: { code: string } }>(
    "/:code",
    async (req, reply) => {
      const { code: param } = req.params;

      // Support both slug (new) and random code (legacy)
      const [invite] = await db
        .select()
        .from(invites)
        .where(or(eq(invites.slug, param), eq(invites.code, param)))
        .limit(1);

      if (!invite) {
        return reply.status(404).send({ error: "Invite not found" });
      }

      if (invite.expiresAt && invite.expiresAt < new Date()) {
        return reply.status(410).send({ error: "Invite expired" });
      }

      if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
        return reply.status(410).send({ error: "Invite limit reached" });
      }

      const [community] = await db
        .select()
        .from(communities)
        .where(eq(communities.id, invite.communityId))
        .limit(1);

      if (!community) {
        return reply.status(404).send({ error: "Community not found" });
      }

      return {
        code: invite.code,
        slug: invite.slug,
        community: {
          id: community.id,
          name: community.name,
          description: community.description,
          // ownerId omitted — no need to expose internal Clerk ID to unauthenticated callers
        },
        expiresAt: invite.expiresAt,
        maxUses: invite.maxUses,
        useCount: invite.useCount,
      };
    }
  );

  // ── POST /api/invites/:code/accept ────────────────────────────────────────
  // Requires auth — joins the community linked to the invite code.
  // The entire check-and-join is wrapped in a transaction with a row-level
  // lock (SELECT FOR UPDATE) on the invite row so that concurrent accepts
  // cannot both pass the maxUses check and both insert a member.
  fastify.post<{ Params: { code: string } }>(
    "/:code/accept",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { code: param } = req.params;

      // Resolve display name before the transaction (Clerk call, avoid holding the lock)
      const displayName = await getClerkDisplayName(req.userId);

      try {
        const result = await db.transaction(async (tx) => {
          // Lock the invite row for the duration of this transaction so
          // concurrent accepts are serialised and cannot double-count uses.
          const [invite] = await tx
            .select()
            .from(invites)
            .where(or(eq(invites.slug, param), eq(invites.code, param)))
            .for("update")
            .limit(1);

          if (!invite) return { status: 404, body: { error: "Invite not found" } };

          if (invite.expiresAt && invite.expiresAt < new Date()) {
            return { status: 410, body: { error: "Invite expired" } };
          }

          if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
            return { status: 410, body: { error: "Invite limit reached" } };
          }

          // Check existing membership inside the transaction to prevent
          // duplicate inserts from concurrent requests.
          const [existing] = await tx
            .select({ id: communityMembers.id })
            .from(communityMembers)
            .where(
              and(
                eq(communityMembers.communityId, invite.communityId),
                eq(communityMembers.userId, req.userId)
              )
            )
            .limit(1);

          if (existing) {
            return { status: 200, body: { communityId: invite.communityId, alreadyMember: true } };
          }

          await tx.insert(communityMembers).values({
            communityId: invite.communityId,
            userId: req.userId,
            role: "member",
            ...(displayName ? { displayName } : {}),
          });

          await tx
            .update(invites)
            .set({ useCount: sql`${invites.useCount} + 1` })
            .where(eq(invites.id, invite.id));

          return { status: 200, body: { communityId: invite.communityId, alreadyMember: false } };
        });

        return reply.status(result.status).send(result.body);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("duplicate key") || msg.includes("community_members_pkey")) {
          // Race condition: another concurrent request inserted the member first
          return { communityId: undefined, alreadyMember: true };
        }
        fastify.log.error({ err }, "POST /api/invites/:code/accept failed");
        return reply.status(500).send({ error: "Internal error" });
      }
    }
  );
}

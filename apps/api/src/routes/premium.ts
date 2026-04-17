import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { getIo } from "../lib/io.js";
import {
  premiumKlips,
  premiumPurchases,
  communityMembers,
} from "@klip/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { z } from "zod";

const createPremiumKlipSchema = z.object({
  communityId: z.string().uuid(),
  klipId: z.string().uuid().nullish(),
  title: z.string().min(1).max(200),
  // Accept number or numeric string from client — coerce to integer cents
  price: z.coerce.number().int().min(100).max(99900),
  contentType: z.enum(["video", "audio", "document", "image", "text"]),
  contentUrl: z.string().url().max(500).nullish(),
  previewText: z.string().max(2000).nullish(),
});

export async function premiumRoutes(fastify: FastifyInstance) {
  // ── GET /api/premium/:communityId ──────────────────────────────────────────
  // Lists all active premium klips for the community.
  // Also returns which ones the current user has already purchased.
  fastify.get<{ Params: { communityId: string } }>(
    "/:communityId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { communityId } = req.params;

      // Membership check
      const [member] = await db
        .select({ role: communityMembers.role })
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!member) {
        return reply.status(403).send({ error: "Not a member" });
      }

      const klipList = await db
        .select()
        .from(premiumKlips)
        .where(
          and(
            eq(premiumKlips.communityId, communityId),
            eq(premiumKlips.isActive, true)
          )
        )
        .orderBy(premiumKlips.createdAt);

      const klipIds = klipList.map((k) => k.id);

      // Find which ones this user already bought
      const purchases =
        klipIds.length > 0
          ? await db
              .select({ premiumKlipId: premiumPurchases.premiumKlipId })
              .from(premiumPurchases)
              .where(
                and(
                  eq(premiumPurchases.userId, req.userId),
                  inArray(premiumPurchases.premiumKlipId, klipIds)
                )
              )
          : [];

      const purchasedIds = purchases.map((p) => p.premiumKlipId);

      return { klips: klipList, purchasedIds };
    }
  );

  // ── POST /api/premium/klip ─────────────────────────────────────────────────
  // Owner or moderator creates a new premium klip.
  fastify.post(
    "/klip",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = createPremiumKlipSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const { communityId, klipId, title, price, contentType, contentUrl, previewText } =
        parsed.data;

      // Only owner / moderator
      const [member] = await db
        .select({ role: communityMembers.role })
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!member || (member.role !== "owner" && member.role !== "moderator")) {
        return reply.status(403).send({ error: "Apenas donos e moderadores podem criar klips premium" });
      }

      let created: typeof premiumKlips.$inferSelect;
      try {
        const [row] = await db
          .insert(premiumKlips)
          .values({
            communityId,
            klipId: klipId ?? null,
            title,
            price,
            contentType,
            contentUrl: contentUrl ?? null,
            previewText: previewText ?? null,
            createdBy: req.userId,
          })
          .returning();
        if (!row) throw new Error("Insert returned no rows");
        created = row;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Database error";
        return reply.status(500).send({ error: `Falha ao criar klip premium: ${msg}` });
      }

      // Notify all community members via WebSocket (personal rooms)
      try {
        const io = getIo();
        const memberRows = await db
          .select({ userId: communityMembers.userId })
          .from(communityMembers)
          .where(eq(communityMembers.communityId, communityId));

        for (const m of memberRows) {
          io.to(`user:${m.userId}`).emit("premium:new", {
            title,
            price,
            communityId,
            premiumKlipId: created.id,
          });
        }
      } catch {
        // Socket not yet initialized in tests — non-fatal
      }

      return reply.status(201).send(created);
    }
  );

  // ── POST /api/premium/:premiumKlipId/purchase ──────────────────────────────
  // Simulated purchase — records the transaction (Stripe real = fase 2).
  fastify.post<{ Params: { premiumKlipId: string } }>(
    "/:premiumKlipId/purchase",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { premiumKlipId } = req.params;

      // Load the klip
      const [klip] = await db
        .select()
        .from(premiumKlips)
        .where(
          and(
            eq(premiumKlips.id, premiumKlipId),
            eq(premiumKlips.isActive, true)
          )
        )
        .limit(1);

      if (!klip) {
        return reply.status(404).send({ error: "Premium klip not found" });
      }

      // Must be a community member
      const [member] = await db
        .select({ role: communityMembers.role })
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, klip.communityId),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!member) {
        return reply.status(403).send({ error: "Not a member of this community" });
      }

      // Atomic check-and-purchase in a transaction to prevent race conditions
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: premiumPurchases.id })
          .from(premiumPurchases)
          .where(
            and(
              eq(premiumPurchases.userId, req.userId),
              eq(premiumPurchases.premiumKlipId, premiumKlipId)
            )
          )
          .limit(1)
          .for("update");

        if (existing) {
          return { success: true, accessGranted: true, alreadyOwned: true } as const;
        }

        await tx
          .insert(premiumPurchases)
          .values({
            userId: req.userId,
            premiumKlipId,
            amountPaid: klip.price,
            stripePaymentId: "sim_test",
          });

        await tx
          .update(premiumKlips)
          .set({ purchaseCount: sql`${premiumKlips.purchaseCount} + 1` })
          .where(eq(premiumKlips.id, premiumKlipId));

        return { success: true, accessGranted: true } as const;
      });

      return result;
    }
  );

  // ── GET /api/premium/:premiumKlipId/access ─────────────────────────────────
  // Returns whether the user has purchased this klip plus the full klip data.
  fastify.get<{ Params: { premiumKlipId: string } }>(
    "/:premiumKlipId/access",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { premiumKlipId } = req.params;

      const [klip] = await db
        .select()
        .from(premiumKlips)
        .where(eq(premiumKlips.id, premiumKlipId))
        .limit(1);

      if (!klip) {
        return reply.status(404).send({ error: "Not found" });
      }

      // Must be a community member to check access
      const [member] = await db
        .select({ role: communityMembers.role })
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, klip.communityId),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!member) {
        return reply.status(403).send({ error: "Not a member" });
      }

      const [purchase] = await db
        .select({ id: premiumPurchases.id })
        .from(premiumPurchases)
        .where(
          and(
            eq(premiumPurchases.userId, req.userId),
            eq(premiumPurchases.premiumKlipId, premiumKlipId)
          )
        )
        .limit(1);

      const hasAccess = Boolean(purchase);

      return {
        hasAccess,
        klip: hasAccess ? klip : {
          ...klip,
          contentUrl: null, // hide URL until purchased
        },
      };
    }
  );
}

import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { getIo, tryEmit } from "../lib/io.js";
import {
  photoAlbums,
  albumPhotos,
  albumPurchases,
  communityMembers,
} from "@klip/db/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";

// ─── Supabase ─────────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
  return createClient(url, key, { auth: { persistSession: false } });
}

const BUCKET = "klip-media";
const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MB

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Assert caller is owner or moderator of the community that owns the album. */
async function assertOwnerOrMod(
  communityId: string,
  userId: string
): Promise<{ ok: true; role: string } | { ok: false; status: 403 | 404 }> {
  const [member] = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);
  if (!member) return { ok: false, status: 403 };
  if (member.role !== "owner" && member.role !== "moderator") return { ok: false, status: 403 };
  return { ok: true, role: member.role };
}

/** Assert caller is a member of the community. */
async function assertMember(
  communityId: string,
  userId: string
): Promise<{ ok: true; role: string } | { ok: false; status: 403 }> {
  const [member] = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);
  if (!member) return { ok: false, status: 403 };
  return { ok: true, role: member.role };
}

/** Fetch preview photos for an album. If not purchased, only blurUrl is included. */
async function getPreviewPhotos(albumId: string, hasPurchased: boolean, limit = 3) {
  const photos = await db
    .select()
    .from(albumPhotos)
    .where(eq(albumPhotos.albumId, albumId))
    .orderBy(albumPhotos.displayOrder)
    .limit(limit);

  return photos.map((p) => ({
    id: p.id,
    blurUrl: p.blurUrl ?? p.storageUrl,
    ...(hasPurchased ? { thumbnailUrl: p.thumbnailUrl, storageUrl: p.storageUrl } : {}),
  }));
}

/** Build the album payload sent over the wire (adding hasPurchased + previewPhotos). */
async function buildAlbumPayload(
  album: typeof photoAlbums.$inferSelect,
  userId: string,
  isOwnerOrMod = false,
) {
  const hasPurchasedByRole = !album.isPremium || isOwnerOrMod;
  const [purchase] = hasPurchasedByRole ? [{ id: "owner" }] : await db
    .select({ id: albumPurchases.id })
    .from(albumPurchases)
    .where(and(eq(albumPurchases.userId, userId), eq(albumPurchases.albumId, album.id)))
    .limit(1);

  const hasPurchased = hasPurchasedByRole || Boolean(purchase);
  const previewPhotos = await getPreviewPhotos(album.id, hasPurchased);

  return { ...album, hasPurchased, previewPhotos };
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createAlbumSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  isPremium:   z.boolean().default(false),
  price:       z.number().positive().optional(),
  topicId:     z.string().uuid().optional(),
  status:      z.enum(["draft", "published"]).default("draft"),
});

const updateAlbumSchema = z.object({
  title:         z.string().min(1).max(200).optional(),
  description:   z.string().max(1000).optional(),
  status:        z.enum(["draft", "published", "archived"]).optional(),
  coverPhotoUrl: z.string().url().optional(),
  price:         z.number().positive().optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function albumRoutes(fastify: FastifyInstance) {
  // ── POST /api/communities/:communityId/albums ─────────────────────────────

  fastify.post<{ Params: { communityId: string } }>(
    "/communities/:communityId/albums",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { communityId } = req.params;
      const auth = await assertOwnerOrMod(communityId, req.userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: "Access denied" });

      const parsed = createAlbumSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const { title, description, isPremium, price, topicId, status } = parsed.data;

      const [album] = await db
        .insert(photoAlbums)
        .values({
          communityId,
          topicId: topicId ?? null,
          createdBy: req.userId,
          title,
          description: description ?? null,
          isPremium,
          price: price != null ? String(price) : null,
          status,
          publishedAt: status === "published" ? new Date() : null,
        })
        .returning();

      return reply.status(201).send(album);
    }
  );

  // ── GET /api/communities/:communityId/albums ───────────────────────────────

  fastify.get<{ Params: { communityId: string }; Querystring: { topicId?: string } }>(
    "/communities/:communityId/albums",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { communityId } = req.params;
      const { topicId } = req.query;

      const member = await assertMember(communityId, req.userId);
      if (!member.ok) return reply.status(member.status).send({ error: "Access denied" });

      const isOwnerOrMod = member.role === "owner" || member.role === "moderator";

      const conditions = [
        eq(photoAlbums.communityId, communityId),
        eq(photoAlbums.status, "published"),
      ];
      if (topicId) conditions.push(eq(photoAlbums.topicId, topicId));

      const albums = await db
        .select()
        .from(photoAlbums)
        .where(and(...conditions))
        .orderBy(desc(photoAlbums.publishedAt));

      const albumIds = albums.map((a) => a.id);
      // Owner/mod sees all albums as purchased; regular members check purchase records
      const purchases = (isOwnerOrMod || albumIds.length === 0)
        ? []
        : await db
            .select({ albumId: albumPurchases.albumId })
            .from(albumPurchases)
            .where(and(eq(albumPurchases.userId, req.userId), inArray(albumPurchases.albumId, albumIds)));

      const purchasedSet = new Set(purchases.map((p) => p.albumId));

      const results = await Promise.all(
        albums.map(async (album) => {
          const hasPurchased = !album.isPremium || isOwnerOrMod || purchasedSet.has(album.id);
          const previewPhotos = await getPreviewPhotos(album.id, hasPurchased);
          return { ...album, hasPurchased, previewPhotos };
        })
      );

      return results;
    }
  );

  // ── GET /api/albums/:albumId ──────────────────────────────────────────────

  fastify.get<{ Params: { albumId: string } }>(
    "/albums/:albumId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { albumId } = req.params;

      const [album] = await db
        .select()
        .from(photoAlbums)
        .where(eq(photoAlbums.id, albumId))
        .limit(1);

      if (!album) return reply.status(404).send({ error: "Album not found" });

      const member = await assertMember(album.communityId, req.userId);
      if (!member.ok) return reply.status(member.status).send({ error: "Access denied" });

      // Owner/moderator always has access (no need to purchase their own content)
      const isOwnerOrMod = member.role === "owner" || member.role === "moderator";

      const [purchase] = isOwnerOrMod ? [{ id: "owner" }] : await db
        .select({ id: albumPurchases.id })
        .from(albumPurchases)
        .where(and(eq(albumPurchases.userId, req.userId), eq(albumPurchases.albumId, albumId)))
        .limit(1);

      const hasPurchased = !album.isPremium || Boolean(purchase);

      if (hasPurchased) {
        const photos = await db
          .select()
          .from(albumPhotos)
          .where(eq(albumPhotos.albumId, albumId))
          .orderBy(albumPhotos.displayOrder);
        return { ...album, hasPurchased: true, photos };
      }

      const previewPhotos = await getPreviewPhotos(albumId, false);
      return { ...album, hasPurchased: false, previewPhotos };
    }
  );

  // ── PATCH /api/albums/:albumId ────────────────────────────────────────────

  fastify.patch<{ Params: { albumId: string } }>(
    "/albums/:albumId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { albumId } = req.params;

      const [album] = await db.select().from(photoAlbums).where(eq(photoAlbums.id, albumId)).limit(1);
      if (!album) return reply.status(404).send({ error: "Album not found" });

      const auth = await assertOwnerOrMod(album.communityId, req.userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: "Access denied" });

      const parsed = updateAlbumSchema.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const { title, description, status, coverPhotoUrl, price } = parsed.data;

      // Set publishedAt when first published
      const isFirstPublish = status === "published" && album.status !== "published";

      const [updated] = await db
        .update(photoAlbums)
        .set({
          ...(title         != null ? { title }         : {}),
          ...(description   != null ? { description }   : {}),
          ...(status        != null ? { status }        : {}),
          ...(coverPhotoUrl != null ? { coverPhotoUrl } : {}),
          ...(price         != null ? { price: String(price) } : {}),
          ...(isFirstPublish        ? { publishedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(photoAlbums.id, albumId))
        .returning();

      // Emit WebSocket event when published
      if (isFirstPublish && updated) {
        try {
          const io = getIo();
          const payload = await buildAlbumPayload(updated, req.userId, auth.ok && (auth.role === "owner" || auth.role === "moderator"));
          io.to(`topic:${album.topicId}`).emit("album:published", {
            albumId: updated.id,
            topicId: album.topicId,
            album: payload,
          });
        } catch {
          // non-fatal
        }
      }

      return updated;
    }
  );

  // ── POST /api/albums/:albumId/photos ──────────────────────────────────────

  fastify.post<{ Params: { albumId: string } }>(
    "/albums/:albumId/photos",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { albumId } = req.params;

      const [album] = await db.select().from(photoAlbums).where(eq(photoAlbums.id, albumId)).limit(1);
      if (!album) return reply.status(404).send({ error: "Album not found" });

      const auth = await assertOwnerOrMod(album.communityId, req.userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: "Access denied" });

      const part = await req.file().catch(() => null);
      if (!part) return reply.status(400).send({ error: "No file provided" });

      const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
      if (!ALLOWED.has(part.mimetype)) {
        return reply.status(415).send({ error: "Only JPEG, PNG and WebP images are allowed" });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of part.file) chunks.push(chunk as Buffer);
      const buffer = Buffer.concat(chunks);

      if (buffer.length > MAX_PHOTO_BYTES) {
        return reply.status(413).send({ error: "Image too large (max 20 MB)" });
      }

      // Magic bytes validation
      const detected = await fileTypeFromBuffer(buffer);
      if (!detected || !ALLOWED.has(detected.mime)) {
        return reply.status(415).send({ error: "File content does not match declared type" });
      }

      const supabase = getSupabase();
      const ext = detected.ext;
      const fileUuid = randomUUID();
      const originalPath = `albums/${albumId}/original/${fileUuid}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(originalPath, buffer, { contentType: detected.mime, upsert: false });

      if (uploadError) {
        fastify.log.error(uploadError, "Album photo upload failed");
        return reply.status(500).send({ error: "Upload failed" });
      }

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(originalPath);

      // Count existing photos to determine display order
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(albumPhotos)
        .where(eq(albumPhotos.albumId, albumId));

      const displayOrder = Number(countRow?.count ?? 0);

      const [photo] = await db
        .insert(albumPhotos)
        .values({
          albumId,
          uploadedBy: req.userId,
          storageUrl:   publicUrl,
          thumbnailUrl: publicUrl, // full-res serves as thumbnail (resize can be added with sharp later)
          blurUrl:      publicUrl, // frontend applies CSS blur for locked preview
          displayOrder,
          fileSizeKb: Math.ceil(buffer.length / 1024),
        })
        .returning();

      // Increment photo_count
      await db
        .update(photoAlbums)
        .set({ photoCount: sql`${photoAlbums.photoCount} + 1`, updatedAt: new Date() })
        .where(eq(photoAlbums.id, albumId));

      return reply.status(201).send(photo);
    }
  );

  // ── DELETE /api/albums/:albumId/photos/:photoId ───────────────────────────

  fastify.delete<{ Params: { albumId: string; photoId: string } }>(
    "/albums/:albumId/photos/:photoId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { albumId, photoId } = req.params;

      const [album] = await db.select().from(photoAlbums).where(eq(photoAlbums.id, albumId)).limit(1);
      if (!album) return reply.status(404).send({ error: "Album not found" });

      const auth = await assertOwnerOrMod(album.communityId, req.userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: "Access denied" });

      await db.delete(albumPhotos).where(and(eq(albumPhotos.id, photoId), eq(albumPhotos.albumId, albumId)));

      await db
        .update(photoAlbums)
        .set({ photoCount: sql`GREATEST(${photoAlbums.photoCount} - 1, 0)`, updatedAt: new Date() })
        .where(eq(photoAlbums.id, albumId));

      return reply.status(204).send();
    }
  );

  // ── POST /api/albums/:albumId/purchase ────────────────────────────────────

  fastify.post<{ Params: { albumId: string } }>(
    "/albums/:albumId/purchase",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { albumId } = req.params;

      const [album] = await db
        .select()
        .from(photoAlbums)
        .where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.status, "published")))
        .limit(1);

      if (!album) return reply.status(404).send({ error: "Album not found" });
      if (!album.isPremium) return reply.status(400).send({ error: "Album is free" });

      const member = await assertMember(album.communityId, req.userId);
      if (!member.ok) return reply.status(member.status).send({ error: "Not a member" });

      // Idempotent — already purchased
      const [existing] = await db
        .select({ id: albumPurchases.id })
        .from(albumPurchases)
        .where(and(eq(albumPurchases.userId, req.userId), eq(albumPurchases.albumId, albumId)))
        .limit(1);

      if (existing) {
        return { success: true, accessGranted: true, alreadyOwned: true };
      }

      // Simulated payment — real Stripe: create PaymentIntent, return clientSecret
      await db
        .insert(albumPurchases)
        .values({
          userId: req.userId,
          albumId,
          amountPaid: album.price ?? "0",
          stripePaymentId: "sim_test",
        })
        .onConflictDoNothing();

      await db
        .update(photoAlbums)
        .set({ purchaseCount: sql`${photoAlbums.purchaseCount} + 1` })
        .where(eq(photoAlbums.id, albumId));

      // Fetch full photos for this user and notify via WebSocket
      try {
        const photos = await db
          .select()
          .from(albumPhotos)
          .where(eq(albumPhotos.albumId, albumId))
          .orderBy(albumPhotos.displayOrder);

        tryEmit(`user:${req.userId}`, "album:purchased", {
          albumId,
          photos: photos.map((p) => ({
            id: p.id,
            storageUrl: p.storageUrl,
            thumbnailUrl: p.thumbnailUrl,
            blurUrl: p.blurUrl,
            caption: p.caption,
            displayOrder: p.displayOrder,
          })),
        });
      } catch {
        // non-fatal
      }

      return { success: true, accessGranted: true };
    }
  );
}

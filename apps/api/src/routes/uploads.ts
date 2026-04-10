import type { FastifyInstance } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { requireAuth } from "../plugins/auth.js";
import type { Attachment } from "@klip/db/schema";

// ─── Supabase client (lazy — only created when env vars are present) ─────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) are required for uploads"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

const BUCKET = "klip-media";

// ─── Allowed MIME types ───────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

// ─── Route ────────────────────────────────────────────────────────────────────

export async function uploadsRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/",
    { preHandler: requireAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      // @fastify/multipart must be registered on the instance
      const part = await req.file();

      if (!part) {
        return reply.status(400).send({ error: "No file provided" });
      }

      const mimeType = part.mimetype;
      const isImage = ALLOWED_IMAGE_TYPES.has(mimeType);
      const isAudio = ALLOWED_AUDIO_TYPES.has(mimeType);

      if (!isImage && !isAudio) {
        return reply.status(415).send({
          error: `Unsupported file type: ${mimeType}. Allowed: images (jpeg, png, webp, gif) and audio (webm, mp4, mpeg).`,
        });
      }

      // Read stream into buffer to check size
      const chunks: Buffer[] = [];
      for await (const chunk of part.file) {
        chunks.push(chunk as Buffer);
      }
      const buffer = Buffer.concat(chunks);
      const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;

      if (buffer.length > maxBytes) {
        const limitMB = maxBytes / 1024 / 1024;
        return reply.status(413).send({
          error: `File too large. Maximum size for ${isImage ? "images" : "audio"} is ${limitMB} MB.`,
        });
      }

      // Magic bytes validation — verify actual file content matches declared MIME type.
      // Prevents attackers from uploading malicious files (e.g. an HTML/EXE)
      // with a forged Content-Type header by inspecting the binary signature.
      const detected = await fileTypeFromBuffer(buffer);
      const detectedMime = detected?.mime ?? null;

      // Audio/webm may be detected as video/webm by file-type (same container)
      const normalised = detectedMime === "video/webm" ? "audio/webm" : detectedMime;

      // Strict match: the detected MIME must equal the declared MIME exactly.
      // Allowing "in allowed set but different" would let audio pass as image (or vice versa).
      if (!normalised || normalised !== mimeType) {
        return reply.status(415).send({
          error: "File content does not match the declared type. Upload rejected.",
        });
      }

      // Build a unique storage path
      const ext = mimeType.split("/")[1]?.split(";")[0] ?? "bin";
      const folder = isImage ? "images" : "audio";
      const storagePath = `${folder}/${req.userId}/${randomUUID()}.${ext}`;

      // Reuse a single Supabase client for both upload and publicUrl operations
      const supabase = getSupabase();

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        fastify.log.error(uploadError, "Supabase upload failed");
        return reply.status(500).send({ error: "Upload failed. Please try again." });
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

      const attachment: Omit<Attachment, "duration"> = {
        type: isImage ? "image" : "audio",
        url: publicUrl,
        name: part.filename || storagePath.split("/").pop() || "file",
        size: buffer.length,
      };

      return reply.status(201).send(attachment);
    }
  );
}

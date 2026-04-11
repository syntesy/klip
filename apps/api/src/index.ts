import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { Server } from "socket.io";
import type { IncomingMessage, ServerResponse, Server as NodeServer } from "node:http";
import { communitiesRoutes } from "./routes/communities.js";
import { topicsRoutes } from "./routes/topics.js";
import { messagesRoutes } from "./routes/messages.js";
import { klipsRoutes } from "./routes/klips.js";
import { aiRoutes } from "./routes/ai.js";
import { invitesRoutes } from "./routes/invites.js";
import { uploadsRoutes } from "./routes/uploads.js";
import { voiceRoutes } from "./routes/voice.js";
import { premiumRoutes } from "./routes/premium.js";
import { savedMessagesRoutes } from "./routes/savedMessages.js";
import { klipAiRoutes } from "./routes/klipAi.js";
import multipart from "@fastify/multipart";
import { registerSocketHandlers } from "./socket/index.js";

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);

// Dev web runs on 3002; keep 3000 as fallback
const WEB_ORIGINS =
  process.env.NODE_ENV === "production"
    ? [process.env.WEB_URL ?? "https://klip.app"]
    : [process.env.WEB_URL ?? "http://localhost:3002", "http://localhost:3000"];

const fastify = Fastify({
  logger:
    process.env.NODE_ENV === "development"
      ? { level: "info", transport: { target: "pino-pretty" } }
      : true,
});

await fastify.register(multipart, {
  limits: { fileSize: 26 * 1024 * 1024 }, // 26 MB hard ceiling
});

await fastify.register(cors, {
  origin: WEB_ORIGINS,
  credentials: true,
});

// Global rate limit: 200 req/min per IP — individual sensitive routes may override
await fastify.register(rateLimit, {
  max: 200,
  timeWindow: "1 minute",
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: "Muitas requisições. Tente novamente em breve.",
  }),
});

// ── CSRF / Origin check ────────────────────────────────────────────────────────
// Defence-in-depth: reject state-mutating requests (POST/PUT/PATCH/DELETE) that
// carry an Origin header pointing at a disallowed host.
// - Same-origin browser requests have no Origin header → allowed.
// - Non-browser clients (mobile, curl, server-to-server) have no Origin → allowed.
// - Cross-origin browser requests from our frontend have a matching Origin → allowed.
// - CSRF attempts from a third-party page will send a non-matching Origin → blocked.
//
// This complements the JWT Bearer auth (which also blocks CSRF on its own)
// and the CORS config already in place.
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const WEB_ORIGINS_SET = new Set(WEB_ORIGINS);

fastify.addHook("onRequest", (req, reply, done) => {
  const origin = req.headers["origin"];
  if (origin && MUTATION_METHODS.has(req.method) && !WEB_ORIGINS_SET.has(origin)) {
    reply.status(403).send({ error: "Forbidden: invalid origin" });
    return;
  }
  done();
});

// ── Routes ─────────────────────────────────────────────────────────────────────
await fastify.register(communitiesRoutes, { prefix: "/api/communities" });
await fastify.register(topicsRoutes, { prefix: "/api/topics" });
await fastify.register(messagesRoutes, { prefix: "/api/messages" });
await fastify.register(klipsRoutes, { prefix: "/api/klips" });
await fastify.register(aiRoutes, { prefix: "/api/ai" });
await fastify.register(invitesRoutes, { prefix: "/api/invites" });
await fastify.register(uploadsRoutes, { prefix: "/api/uploads" });
await fastify.register(voiceRoutes, { prefix: "/api" });
await fastify.register(premiumRoutes, { prefix: "/api/premium" });
await fastify.register(savedMessagesRoutes, { prefix: "/api" });
await fastify.register(klipAiRoutes, { prefix: "/api/topics" });

// Health check
fastify.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// ── Socket.io ──────────────────────────────────────────────────────────────────
// Attach after fastify.ready() so fastify.server is a plain HTTP server
await fastify.ready();

const io = new Server(
  fastify.server as NodeServer<typeof IncomingMessage, typeof ServerResponse>,
  { cors: { origin: WEB_ORIGINS, credentials: true } }
);

registerSocketHandlers(io);

// ── Start ──────────────────────────────────────────────────────────────────────
try {
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

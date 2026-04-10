import { verifyToken } from "@clerk/backend";
import type { FastifyRequest, FastifyReply } from "fastify";

// Fail fast at module load time — same guarantee as the Clerk singleton in lib/clerk.ts
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
  throw new Error("CLERK_SECRET_KEY environment variable is required");
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const result = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    req.userId = result.sub;
  } catch {
    reply.status(401).send({ error: "Invalid token" });
  }
}

// Augment Fastify request type
declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

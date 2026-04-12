import { verifyToken } from "@clerk/backend";
import type { FastifyRequest, FastifyReply } from "fastify";

// Fail fast at module load time — same guarantee as the Clerk singleton in lib/clerk.ts
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
  throw new Error("CLERK_SECRET_KEY environment variable is required");
}

const VERIFY_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`verifyToken timed out after ${ms}ms`)), ms)
    ),
  ]);
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
    const result = await withTimeout(
      verifyToken(token, { secretKey: CLERK_SECRET_KEY! }),
      VERIFY_TIMEOUT_MS
    );
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

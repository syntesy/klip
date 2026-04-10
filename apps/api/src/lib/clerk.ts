import { createClerkClient } from "@clerk/backend";

const secretKey = process.env.CLERK_SECRET_KEY;

if (!secretKey) {
  throw new Error("CLERK_SECRET_KEY environment variable is required");
}

/**
 * Singleton Clerk client — import this instead of calling createClerkClient() in each module.
 * Having a single instance avoids creating multiple JWKS caches and HTTP agent pools.
 */
export const clerkClient = createClerkClient({ secretKey });

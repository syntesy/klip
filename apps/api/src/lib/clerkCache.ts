import { createClerkClient } from "@clerk/backend";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY ?? "" });

interface CachedName {
  name: string;
  exp: number; // unix ms
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CachedName>();

/**
 * Returns the display name for a Clerk user ID.
 * Results are cached for 5 minutes to reduce Clerk API calls.
 */
export async function getClerkDisplayName(userId: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.exp > now) return cached.name;

  try {
    const user = await clerk.users.getUser(userId);
    const name = user.fullName ?? user.firstName ?? userId;
    cache.set(userId, { name, exp: now + TTL_MS });
    return name;
  } catch {
    return userId;
  }
}

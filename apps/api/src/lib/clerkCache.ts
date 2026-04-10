import { clerkClient } from "./clerk.js";

interface CachedName {
  name: string;
  exp: number; // unix ms
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 5_000; // 5 seconds — Clerk must respond within this window
const cache = new Map<string, CachedName>();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Clerk fetch timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Returns the display name for a Clerk user ID.
 * Results are cached for 5 minutes.
 * Falls back to the userId string on any error (timeout, network, etc).
 */
export async function getClerkDisplayName(userId: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.exp > now) return cached.name;

  try {
    const user = await withTimeout(clerkClient.users.getUser(userId), FETCH_TIMEOUT_MS);
    const name =
      user.fullName ??
      user.firstName ??
      user.emailAddresses[0]?.emailAddress ??
      userId;
    cache.set(userId, { name, exp: now + TTL_MS });
    return name;
  } catch (err) {
    // Non-fatal: return userId as fallback; don't cache the failure so next request retries
    return userId;
  }
}

/**
 * Bulk-resolves display names for multiple user IDs in a single Clerk API call.
 * Falls back to individual cached lookups where possible.
 * Returns a Map<userId, displayName>.
 */
export async function bulkGetClerkDisplayNames(
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const now = Date.now();
  const result = new Map<string, string>();
  const missing: string[] = [];

  // Serve from cache first
  for (const id of userIds) {
    const cached = cache.get(id);
    if (cached && cached.exp > now) {
      result.set(id, cached.name);
    } else {
      missing.push(id);
    }
  }

  if (missing.length === 0) return result;

  try {
    const { data: clerkUsers } = await withTimeout(
      clerkClient.users.getUserList({ userId: missing, limit: missing.length }),
      FETCH_TIMEOUT_MS
    );

    for (const u of clerkUsers) {
      const name =
        u.fullName ??
        u.firstName ??
        u.emailAddresses[0]?.emailAddress ??
        u.id;
      result.set(u.id, name);
      cache.set(u.id, { name, exp: now + TTL_MS });
    }
  } catch {
    // Non-fatal: missing entries will fall back to userId below
  }

  // Ensure every requested ID has an entry (fall back to userId)
  for (const id of missing) {
    if (!result.has(id)) result.set(id, id);
  }

  return result;
}

/**
 * Shared guards for all routes that call Anthropic:
 *   - Per-userId rate limiter (prevents cost amplification attacks)
 *   - Circuit breaker (prevents cascading failures when Anthropic is down)
 *   - Markdown sanitizer (prevents XSS in AI-generated content)
 */

// ─── Per-userId rate limiter ──────────────────────────────────────────────────
// Max 3 AI requests per user per 60 seconds.
// In-memory; safe for single-instance Railway deployment.

const RATE_MAX = 3;
const RATE_WINDOW_MS = 60_000;

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (bucket.count >= RATE_MAX) return false;

  bucket.count += 1;
  return true;
}

// Purge expired buckets every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(id);
  }
}, 120_000).unref();

// ─── Circuit breaker ──────────────────────────────────────────────────────────
// CLOSED → (5 failures) → OPEN → (60s timeout) → HALF_OPEN → CLOSED/OPEN

const CB_FAILURE_THRESHOLD = 5;
const CB_RESET_TIMEOUT_MS = 60_000;

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreaker {
  state: CircuitState = "CLOSED";
  failures = 0;
  openedAt = 0;

  isOpen(): boolean {
    if (this.state === "CLOSED" || this.state === "HALF_OPEN") return false;
    if (Date.now() - this.openedAt >= CB_RESET_TIMEOUT_MS) {
      this.state = "HALF_OPEN";
      return false;
    }
    return true;
  }

  onSuccess(): void {
    this.failures = 0;
    this.state = "CLOSED";
  }

  onFailure(): void {
    this.failures += 1;
    if (this.state === "HALF_OPEN" || this.failures >= CB_FAILURE_THRESHOLD) {
      this.state = "OPEN";
      this.openedAt = Date.now();
    }
  }
}

// One circuit breaker shared across all Anthropic callers in the process
export const anthropicCircuitBreaker = new CircuitBreaker();

// ─── XSS sanitization ────────────────────────────────────────────────────────
// Strip all HTML tags from AI-generated markdown before storing or returning.
// Prevents script injection if the content is rendered as HTML in the browser.

export function sanitizeMarkdown(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

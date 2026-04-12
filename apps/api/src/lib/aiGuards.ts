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
// CLOSED → (5 failures) → OPEN → (exponential backoff) → HALF_OPEN → CLOSED/OPEN
// Reset timeout doubles on each consecutive open: 60s → 120s → 240s … capped at 10min

const CB_FAILURE_THRESHOLD = 5;
const CB_BASE_RESET_MS = 60_000;
const CB_MAX_RESET_MS = 600_000; // 10 minutes

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreaker {
  state: CircuitState = "CLOSED";
  failures = 0;
  openedAt = 0;
  openCount = 0; // consecutive open cycles — drives backoff exponent

  private resetTimeout(): number {
    return Math.min(CB_BASE_RESET_MS * Math.pow(2, this.openCount - 1), CB_MAX_RESET_MS);
  }

  isOpen(): boolean {
    if (this.state === "CLOSED" || this.state === "HALF_OPEN") return false;
    if (Date.now() - this.openedAt >= this.resetTimeout()) {
      this.state = "HALF_OPEN";
      return false;
    }
    return true;
  }

  onSuccess(): void {
    this.failures = 0;
    this.openCount = 0;
    this.state = "CLOSED";
  }

  onFailure(): void {
    this.failures += 1;
    if (this.state === "HALF_OPEN" || this.failures >= CB_FAILURE_THRESHOLD) {
      this.openCount += 1;
      this.state = "OPEN";
      this.openedAt = Date.now();
    }
  }
}

// One circuit breaker shared across all Anthropic callers in the process
export const anthropicCircuitBreaker = new CircuitBreaker();

// ─── XSS sanitization ────────────────────────────────────────────────────────
// Strip HTML tags and escape any residual angle brackets from AI-generated
// markdown before storing or returning. Defense-in-depth: even if tag stripping
// misses a malformed tag (e.g. nested or split tags), leftover `<` / `>` are
// rendered as text by the browser rather than executed as HTML.

export function sanitizeMarkdown(text: string): string {
  // 1. Strip well-formed tags
  const stripped = text.replace(/<[^>]*>/g, "");
  // 2. Escape any remaining angle brackets so they can't form tags
  return stripped.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

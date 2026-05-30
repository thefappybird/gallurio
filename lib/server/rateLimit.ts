import "server-only";

// In-memory, per-key sliding-window rate limiter.
//
// Scope & limitations (read before reusing): this lives in a single process's
// heap. On Fluid Compute a function instance is reused across requests, so this
// holds for the lifetime of a warm instance — good enough to blunt the public
// inquiry form against casual spam and accidental double-submits. It is NOT a
// distributed limiter: a second instance has its own counters, and a cold start
// resets them. Per the simplicity principle we do not pull in Redis/Upstash
// until a real second-instance abuse problem proves the need. When that day
// comes, swap the Map for a Redis sorted-set keyed the same way — the public
// `rateLimit()` signature can stay identical.

export type RateLimitResult = {
  /** Whether this hit is allowed (false → caller should return 429). */
  ok: boolean;
  /** Remaining hits in the current window after counting this one. */
  remaining: number;
  /** Epoch ms when the oldest in-window hit expires (the window frees up). */
  resetAt: number;
};

export type RateLimitOptions = {
  /** Max allowed hits within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock for deterministic tests. Defaults to Date.now. */
  now?: () => number;
};

// key → ascending list of hit timestamps (ms) still within the window.
const buckets = new Map<string, number[]>();

// Opportunistic memory guard: if the map grows past this many distinct keys we
// drop the whole thing. Keys are IPs; under normal traffic this never trips,
// but it bounds memory against a key-space flood (spoofed X-Forwarded-For).
const MAX_KEYS = 10_000;

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const { limit, windowMs } = opts;
  const now = opts.now ? opts.now() : Date.now();
  const windowStart = now - windowMs;

  if (buckets.size > MAX_KEYS) buckets.clear();

  const prior = buckets.get(key);
  // Keep only hits still inside the window.
  const recent = prior ? prior.filter((t) => t > windowStart) : [];

  if (recent.length >= limit) {
    // Rejected — do NOT record this hit (so a hammering client can't push its
    // own reset time forever into the future).
    buckets.set(key, recent);
    return {
      ok: false,
      remaining: 0,
      resetAt: recent[0] + windowMs,
    };
  }

  recent.push(now);
  buckets.set(key, recent);
  return {
    ok: true,
    remaining: limit - recent.length,
    resetAt: recent[0] + windowMs,
  };
}

// Test-only: wipe all counters so cases don't bleed into each other.
export function __resetRateLimitForTests(): void {
  buckets.clear();
}

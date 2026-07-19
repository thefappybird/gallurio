import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";

// ---------------------------------------------------------------------------
// TTL-indexed collection for auth rate-limit counters
// ---------------------------------------------------------------------------
//
// Each document tracks the attempt count for a (key, window) bucket. The
// expiresAt field carries a TTL index so Mongo automatically cleans up expired
// buckets — no manual sweep needed.
//
// Atomic $inc + upsert means concurrent requests can never race each other into
// an inconsistent count: Mongo's findAndModify is a single atomic operation.

const rateLimitEntrySchema = new Schema(
  {
    // key encodes the dimension: "email:<addr>" or "ip:<addr>"
    key: { type: String, required: true },
    // Epoch-second bucket start — all hits in the same 15-min window share one doc.
    windowStart: { type: Number, required: true },
    count: { type: Number, required: true, default: 0 },
    // TTL index target: Mongo removes the doc when this time passes.
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false },
);

// Compound unique index: one counter per (key, windowStart) bucket.
rateLimitEntrySchema.index({ key: 1, windowStart: 1 }, { unique: true });
// TTL index: Mongo's background job drops expired documents automatically.
rateLimitEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

type RateLimitEntryDoc = InferSchemaType<typeof rateLimitEntrySchema> & {
  _id: mongoose.Types.ObjectId;
};

// Lazy-register the model so test suites running in the same process don't
// hit "Cannot overwrite model" errors.
const RateLimitEntry: Model<RateLimitEntryDoc> =
  (mongoose.models.AuthRateLimitEntry as Model<RateLimitEntryDoc>) ??
  mongoose.model<RateLimitEntryDoc>("AuthRateLimitEntry", rateLimitEntrySchema);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_LIMIT = 5; // max attempts per email per window
const IP_LIMIT = 20; // max attempts per IP per window

// ---------------------------------------------------------------------------
// Internal: atomic increment
// ---------------------------------------------------------------------------

async function increment(key: string, nowMs: number): Promise<number> {
  const windowStart = Math.floor(nowMs / WINDOW_MS) * WINDOW_MS;
  const expiresAt = new Date(windowStart + WINDOW_MS + 60_000); // +1 min grace

  // findOneAndUpdate with upsert is atomic in MongoDB — no read-then-write race.
  const doc = await RateLimitEntry.findOneAndUpdate(
    { key, windowStart },
    {
      $inc: { count: 1 },
      $setOnInsert: { key, windowStart, expiresAt },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return doc!.count;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type AuthRateLimitInput = {
  email?: string;
  ip?: string;
};

export type AuthRateLimitResult = {
  ok: boolean;
  /** Seconds until the current window resets. 0 when ok is true. */
  retryAfterSec: number;
};

/**
 * Checks and increments the auth rate-limit counters for the given email and/or
 * IP. Both dimensions are enforced independently — failing either blocks the
 * request. The caller should supply at least one dimension.
 *
 * Per spec:
 *   - Email: 5 attempts / 15 min
 *   - IP:    20 attempts / 15 min
 *
 * Returns { ok: true } when both limits have headroom remaining.
 * Returns { ok: false, retryAfterSec } when either limit is breached.
 */
export async function checkAuthRateLimit(
  input: AuthRateLimitInput,
  nowMs: number = Date.now(),
): Promise<AuthRateLimitResult> {
  await connectDB();

  const { email, ip } = input;
  const windowStart = Math.floor(nowMs / WINDOW_MS) * WINDOW_MS;
  const windowEnd = windowStart + WINDOW_MS;
  const retryAfterSec = Math.ceil((windowEnd - nowMs) / 1000);

  const checks: Array<{ key: string; limit: number }> = [];
  if (email) checks.push({ key: `email:${email.toLowerCase().trim()}`, limit: EMAIL_LIMIT });
  if (ip) checks.push({ key: `ip:${ip}`, limit: IP_LIMIT });

  for (const { key, limit } of checks) {
    const count = await increment(key, nowMs);
    if (count > limit) {
      return { ok: false, retryAfterSec };
    }
  }

  return { ok: true, retryAfterSec: 0 };
}

// ---------------------------------------------------------------------------
// Test helper — wipes all counters. Never call in production code.
// ---------------------------------------------------------------------------

export async function __resetAuthRateLimitForTests(): Promise<void> {
  await RateLimitEntry.deleteMany({});
}

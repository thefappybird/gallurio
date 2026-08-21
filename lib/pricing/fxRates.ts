import { env } from "@/lib/env";
import { connectDB } from "@/lib/db/mongoose";
import { FxRateTable, FxFetchLock } from "@/lib/db/models/FxRateTable";

// Daily FX reference rates. Display and aggregation only — never used to
// charge anyone.
//
// Open Exchange Rates, via OPENEXCHANGERATES_APP_ID. The free plan serves one
// USD-based table per call (`base` is a paid feature), so every non-USD pair is
// cross-rated off that single table — which also means one fetch per day covers
// every currency in the app.
//
// The daily table is persisted in Mongo (lib/db/models/FxRateTable.ts) and
// normally populated once a day by app/api/cron/fx-rates/route.ts, not by this
// module — see docs/pricing/currency-conversion.md for the full read-path
// layering and why. This module only reads that table (with a same-process
// fetch fallback if the cron ever misses a day) and cross-rates pairs off it.
//
// Every failure path returns null so callers fall back to showing the raw
// amount rather than a wrong converted number.
const ENDPOINT = "https://openexchangerates.org/api/latest.json";
const MEMO_TTL_MS = 15 * 60 * 1000; // keeps per-render work off Mongo
const LEASE_TTL_MS = 60 * 1000; // how long one caller's fetch attempt blocks others
const TIMEOUT_MS = 3000;
const BASE = "USD";
const LOCK_ID = "fx-fetch-lock";

type RateTable = Record<string, number>;

// In-process memo only — the durable cache is the FxRateTable collection.
let memo: { rates: RateTable; expiresAt: number } | null = null;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

function memoize(rates: RateTable): RateTable {
  memo = { rates, expiresAt: Date.now() + MEMO_TTL_MS };
  return rates;
}

// One call to Open Exchange Rates, or null on any failure (timeout, non-2xx,
// missing key, unexpected shape).
async function fetchFromOxr(): Promise<RateTable | null> {
  const appId = env.OPENEXCHANGERATES_APP_ID;
  if (!appId) return null;

  try {
    const res = await fetch(`${ENDPOINT}?app_id=${encodeURIComponent(appId)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const body = (await res.json()) as { rates?: RateTable };
    if (typeof body.rates?.USD !== "number") {
      throw new Error("Unexpected response shape");
    }
    return body.rates;
  } catch (err) {
    console.error(
      "[fx] Failed to fetch reference rates, currency conversion disabled:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// Attempts to become the single fetcher for today's table, across every
// container. Returns true when this call holds the lease — either the lock
// row didn't exist yet, or the previous lease had already expired — and
// false when another caller currently holds a live lease. A contended upsert
// on an unexpired lock can also surface as a duplicate-key error (both
// callers racing to insert the same _id); that is just another way of losing
// the race, not a real failure.
async function claimFetchLease(now: Date): Promise<boolean> {
  try {
    await FxFetchLock.findOneAndUpdate(
      { _id: LOCK_ID, lockedUntil: { $lt: now } },
      { $set: { lockedUntil: new Date(now.getTime() + LEASE_TTL_MS) } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}

// Upserts today's table. Idempotent — a second write the same day (the cron
// firing twice, or this module's own fallback racing the cron) just
// overwrites with the same/newer data.
async function persistTable(day: string, rates: RateTable, fetchedAt: Date): Promise<void> {
  await FxRateTable.findOneAndUpdate(
    { _id: day },
    { $set: { base: BASE, rates, fetchedAt } },
    { upsert: true }
  );
}

// Fetches today's table and upserts it. Exported for the daily cron
// (app/api/cron/fx-rates/route.ts), which is the only steady-state caller of
// Open Exchange Rates — no lease needed here, since the cron is the single
// scheduled writer and a double-fire is harmless (persistTable is idempotent).
// Returns the fetched table, or null if the upstream call failed.
export async function refreshFxRateTable(): Promise<RateTable | null> {
  await connectDB();
  const fetched = await fetchFromOxr();
  if (!fetched) return null;
  const now = new Date();
  await persistTable(todayUtc(), fetched, now);
  return fetched;
}

// Three read layers, Open Exchange Rates last:
//   1. in-process memo (~15 min) — keeps per-render work off Mongo.
//   2. today's persisted table, if the daily cron already wrote it.
//   3. only when today's table is missing: one caller claims a short lease
//      and fetches directly; every other caller (including the loser of a
//      lease race) falls through to serving whatever table is already
//      stored, however stale — an outage should degrade conversions to
//      "yesterday's rate", never to "no conversion at all". Returns null
//      only when there is no stored table whatsoever (a cold start against a
//      broken upstream).
async function getRateTable(): Promise<RateTable | null> {
  const cached = memo;
  if (cached && cached.expiresAt > Date.now()) return cached.rates;

  try {
    await connectDB();
    const now = new Date();
    const today = todayUtc();
    const latest = await FxRateTable.findOne()
      .sort({ _id: -1 })
      .limit(1)
      .lean<{ _id: string; rates: RateTable }>();

    if (latest && latest._id === today) {
      return memoize(latest.rates);
    }

    if (await claimFetchLease(now)) {
      const fetched = await fetchFromOxr();
      if (fetched) {
        await persistTable(today, fetched, now);
        return memoize(fetched);
      }
    }

    if (latest) return memoize(latest.rates);
    return null;
  } catch (err) {
    console.error(
      "[fx] Failed to read the stored rate table:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// Returns how many units of `target` one unit of `base` buys, or null when the
// rate is unavailable for any reason.
export async function getFxRate(base: string, target: string): Promise<number | null> {
  const from = base.toUpperCase();
  const to = target.toUpperCase();
  if (from === to) return 1;

  const rates = await getRateTable();
  if (!rates) return null;

  // The free plan only serves a USD-based table, so every non-USD pair is
  // cross-rated: (USD -> to) / (USD -> from).
  const perUsdFrom = rates[from];
  const perUsdTo = rates[to];
  if (!(perUsdFrom > 0) || !(perUsdTo > 0)) return null;

  return perUsdTo / perUsdFrom;
}

// Resolves a freeze-worthy FX snapshot for a booking write: `{ rate, target }`
// to store on a payment/amount, or `null` when unavailable — the caller then
// leaves the write unfrozen and the read path falls back to a live rate. Same
// currency still returns `{ rate: 1, target }` (a real, storable freeze).
// Never throws: an FX outage must never fail or block a booking write.
export async function resolveFxFreeze(
  base: string,
  target: string
): Promise<{ rate: number; target: string } | null> {
  try {
    const rate = await getFxRate(base, target);
    return rate != null && rate > 0 ? { rate, target } : null;
  } catch {
    return null;
  }
}

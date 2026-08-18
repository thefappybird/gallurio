import type { Types } from "mongoose";
import { Booking, Transaction } from "@/lib/db/models";
import { buildRateMap, type RateMap } from "./currencyConverter";

// Per-workspace memo so dashboard/page.tsx, clients/page.tsx, and
// lib/actions/clients.ts share one result instead of each re-running the two
// `distinct` collection scans. Short TTL — a stale map for a few minutes is
// harmless (only display totals use it); MAX_ENTRIES bounds the map so a
// long-lived, many-tenant process can't grow it without limit (oldest entry
// evicted first, Map preserves insertion order).
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { value: RateMap; expiresAt: number }>();

function cacheKey(workspaceId: Types.ObjectId | string, workspaceCurrency: string): string {
  return `${String(workspaceId)}:${workspaceCurrency.toUpperCase()}`;
}

// Resolves the multipliers needed to roll one workspace's money up into its
// own currency. Money stays stored in the currency it was entered in; only
// aggregate totals are converted.
export async function getWorkspaceRateMap(
  workspaceId: Types.ObjectId | string,
  workspaceCurrency: string
): Promise<RateMap> {
  const key = cacheKey(workspaceId, workspaceCurrency);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const [bookingCurrencies, transactionCurrencies] = await Promise.all([
    Booking.distinct("amount.currency", { workspaceId }),
    Transaction.distinct("currency", { workspaceId }),
  ]);

  const stored = [...bookingCurrencies, ...transactionCurrencies].filter(
    (c): c is string => typeof c === "string" && c.length > 0
  );

  const value = await buildRateMap(workspaceCurrency, [workspaceCurrency, ...stored]);

  if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });

  return value;
}

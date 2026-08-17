import { env } from "@/lib/env";

// Daily FX reference rates. Display and aggregation only — never used to
// charge anyone.
//
// Open Exchange Rates, via OPENEXCHANGERATES_APP_ID. The free plan serves one
// USD-based table per call (`base` is a paid feature), so every non-USD pair is
// cross-rated off that single table — which also means one fetch per day covers
// every currency in the app.
//
// Every failure path returns null so callers fall back to showing the raw
// amount rather than a wrong converted number.
const ENDPOINT = "https://openexchangerates.org/api/latest.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // rates publish once a day
const TIMEOUT_MS = 3000;
const BASE = "USD";

type RateTable = Record<string, number>;

const cache = new Map<string, { rates: RateTable; expiresAt: number }>();

async function getRateTable(): Promise<RateTable | null> {
  const cached = cache.get(BASE);
  if (cached && cached.expiresAt > Date.now()) return cached.rates;

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
    cache.set(BASE, { rates: body.rates, expiresAt: Date.now() + CACHE_TTL_MS });
    return body.rates;
  } catch (err) {
    console.error(
      "[fx] Failed to fetch reference rates, currency conversion disabled:",
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

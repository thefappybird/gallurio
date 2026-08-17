import { PLAN_CATALOG } from "./plans";
import { getLatestVariantPriceCents, getStoreCurrency } from "./client";

export type PriceAmounts = { currency: string; monthly: number; yearly: number };

// `local` is a display-only equivalent in the visitor's currency, attached by
// lib/pricing/localPricing.ts. Absent when it can't be resolved, or when the
// visitor is already in the store's currency. Never authoritative — Lemon
// Squeezy charges `currency`.
export type ProPricing = PriceAmounts & { local?: PriceAmounts | null };

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — pricing is global, not tenant-scoped

let cache: { value: ProPricing; expiresAt: number } | null = null;

function staticFallback(pro: (typeof PLAN_CATALOG)[number]): ProPricing {
  return {
    currency: pro.currency,
    monthly: pro.amount,
    yearly: pro.yearlyAmount ?? pro.amount,
  };
}

// Reads the Pro variants' live Price objects + store currency from Lemon
// Squeezy (see lib/lemonsqueezy/client.ts#getLatestVariantPriceCents /
// #getStoreCurrency) and caches the result for CACHE_TTL_MS — pricing is
// global, not tenant-scoped, so one cache serves every render on the
// long-lived PM2 server. Falls back to the static PLAN_CATALOG PHP amounts on
// any failure (missing/invalid API key, unset variant IDs e.g. local dev,
// network/API error) so this never throws.
export async function getProPricing(): Promise<ProPricing> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const pro = PLAN_CATALOG.find((p) => p.id === "pro")!;
  if (!pro.variantId || !pro.yearlyVariantId) {
    return staticFallback(pro);
  }

  try {
    const currency = await getStoreCurrency();
    const monthlyCents = await getLatestVariantPriceCents(pro.variantId);
    const yearlyCents = await getLatestVariantPriceCents(pro.yearlyVariantId);
    const value: ProPricing = { currency, monthly: monthlyCents / 100, yearly: yearlyCents / 100 };
    cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (err) {
    console.error(
      "[lemonsqueezy] Failed to fetch live Pro pricing, falling back to static catalog:",
      err instanceof Error ? err.message : err
    );
    return staticFallback(pro);
  }
}

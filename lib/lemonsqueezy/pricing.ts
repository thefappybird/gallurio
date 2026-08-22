import type { PricingTier } from "@/lib/pricing/pricingTier";
import { PLAN_CATALOG, getProVariantsForTier } from "./plans";
import { getLatestVariantPriceCents, getStoreCurrency } from "./client";

export type PriceAmounts = { currency: string; monthly: number; yearly: number };

// `local` is a display-only equivalent in the visitor's currency, attached by
// lib/pricing/localPricing.ts. Absent when it can't be resolved, or when the
// visitor is already in the store's currency. Never authoritative — Lemon
// Squeezy charges `currency`.
export type ProPricing = PriceAmounts & { local?: PriceAmounts | null };

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — pricing is global, not tenant-scoped

// One entry per PricingTier — base and global cache/expire independently.
const cache = new Map<PricingTier, { value: ProPricing; expiresAt: number }>();

const STORE_CURRENCY = PLAN_CATALOG.find((p) => p.id === "pro")!.currency;

function staticFallback(tier: PricingTier): ProPricing {
  const variants = getProVariantsForTier(tier);
  return {
    currency: STORE_CURRENCY,
    monthly: variants.monthlyAmount,
    yearly: variants.yearlyAmount,
  };
}

// Reads the given tier's Pro variants' live Price objects + store currency
// from Lemon Squeezy (see lib/lemonsqueezy/client.ts#getLatestVariantPriceCents
// / #getStoreCurrency) and caches the result per tier for CACHE_TTL_MS —
// pricing is global, not tenant-scoped, so one cache entry per tier serves
// every render on the long-lived PM2 server. Falls back to the static
// per-tier USD fallback amounts on any failure (missing/invalid API key,
// unset variant IDs e.g. local dev, network/API error) so this never throws.
export async function getProPricing(tier: PricingTier): Promise<ProPricing> {
  const cached = cache.get(tier);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const variants = getProVariantsForTier(tier);
  if (!variants.monthlyVariantId || !variants.yearlyVariantId) {
    return staticFallback(tier);
  }

  try {
    const currency = await getStoreCurrency();
    const monthlyCents = await getLatestVariantPriceCents(variants.monthlyVariantId);
    const yearlyCents = await getLatestVariantPriceCents(variants.yearlyVariantId);
    const value: ProPricing = { currency, monthly: monthlyCents / 100, yearly: yearlyCents / 100 };
    cache.set(tier, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (err) {
    console.error(
      "[lemonsqueezy] Failed to fetch live Pro pricing, falling back to static catalog:",
      err instanceof Error ? err.message : err
    );
    return staticFallback(tier);
  }
}

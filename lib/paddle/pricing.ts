import { getPaddle } from "./client";
import { getProMonthlyPriceId, PLAN_CATALOG } from "./plans";
import { unstable_cache } from "next/cache";
import type { CountryCode } from "@paddle/paddle-node-sdk";

export type ProPricing = { currency: string; monthly: number; yearly: number };

async function fetchProPricingFromPaddle(countryCode: string): Promise<ProPricing | null> {
  const monthlyPriceId = getProMonthlyPriceId();
  const yearlyPriceId = process.env.PADDLE_PRICE_PRO_YEARLY_ID ?? "";
  if (!monthlyPriceId || !yearlyPriceId) return null;

  try {
    const preview = await getPaddle().pricingPreview.preview({
      items: [
        { priceId: monthlyPriceId, quantity: 1 },
        { priceId: yearlyPriceId, quantity: 1 },
      ],
      address: { countryCode: countryCode as CountryCode },
    });

    const items = preview.details.lineItems;
    const monthlyItem = items.find((i) => i.price.id === monthlyPriceId);
    const yearlyItem = items.find((i) => i.price.id === yearlyPriceId);
    if (!monthlyItem || !yearlyItem) return null;

    const monthly = Number(monthlyItem.unitTotals.total) / 100;
    const yearly = Number(yearlyItem.unitTotals.total) / 100;
    if (!Number.isFinite(monthly) || !Number.isFinite(yearly)) return null;

    return { currency: preview.currencyCode, monthly, yearly };
  } catch {
    return null; // sandbox/dev without PADDLE_API_KEY, unsupported country, network error, etc.
  }
}

async function resolveProPricing(countryCode: string): Promise<ProPricing> {
  const pro = PLAN_CATALOG.find((p) => p.id === "pro")!;
  const fallback: ProPricing = {
    currency: pro.currency,
    monthly: pro.amount,
    yearly: pro.yearlyAmount ?? pro.amount,
  };
  return (await fetchProPricingFromPaddle(countryCode)) ?? fallback;
}

export async function getProPricing(countryCode: string): Promise<ProPricing> {
  try {
    const cached = unstable_cache(resolveProPricing, ["paddle-pro-pricing", countryCode], {
      revalidate: 3600,
    });
    return await cached(countryCode);
  } catch {
    // unstable_cache requires Next's request/build incrementalCache context —
    // fall back to an uncached call (e.g. tests that render a page component
    // directly, outside Next's runtime).
    return resolveProPricing(countryCode);
  }
}

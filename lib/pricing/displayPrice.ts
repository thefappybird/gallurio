import type { ProPricing } from "@/lib/lemonsqueezy/pricing";

/**
 * Which figure a price surface headlines, and which one it names underneath.
 *
 * The visitor's own currency is the headline wherever it could be resolved —
 * a price only reads as a price in a currency you use daily. `billed` is the
 * amount Lemon Squeezy actually charges, and is null when the two are the
 * same currency (nothing to disclose) or when no rate was available.
 *
 * Pure and client-safe: it only picks between figures resolved server-side by
 * getDisplayPricing().
 */
export type HeadlinePrice = {
  amount: number;
  currency: string;
  billed: { amount: number; currency: string } | null;
};

export function headlinePrice(
  pricing: ProPricing,
  cadence: "monthly" | "yearly"
): HeadlinePrice {
  const local = pricing.local;
  if (!local) {
    return { amount: pricing[cadence], currency: pricing.currency, billed: null };
  }
  return {
    amount: local[cadence],
    currency: local.currency,
    billed: { amount: pricing[cadence], currency: pricing.currency },
  };
}

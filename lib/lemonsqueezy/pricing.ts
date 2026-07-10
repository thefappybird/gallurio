import { PLAN_CATALOG } from "./plans";

export type ProPricing = { currency: string; monthly: number; yearly: number };

// Lemon Squeezy has no per-country live-pricing-preview API (unlike Paddle's
// pricingPreview) — always return the static PLAN_CATALOG PHP amounts. Kept
// async so call sites don't need to change if a live preview is ever added.
export async function getProPricing(): Promise<ProPricing> {
  const pro = PLAN_CATALOG.find((p) => p.id === "pro")!;
  return {
    currency: pro.currency,
    monthly: pro.amount,
    yearly: pro.yearlyAmount ?? pro.amount,
  };
}

import { getPaddle } from "./client";
import { PLAN_CATALOG } from "./plans";
import { unstable_cache } from "next/cache";

async function fetchAmount(priceId: string): Promise<number | null> {
  if (!priceId) return null;
  try {
    const price = await getPaddle().prices.get(priceId);
    return Number(price.unitPrice.amount) / 100;
  } catch {
    return null; // sandbox/dev without PADDLE_API_KEY, price not found, network error, etc.
  }
}

async function resolveProPricing() {
  const pro = PLAN_CATALOG.find((p) => p.id === "pro")!;
  const [monthly, yearly] = await Promise.all([
    fetchAmount(process.env.PADDLE_PRICE_PRO_ID ?? ""),
    fetchAmount(process.env.PADDLE_PRICE_PRO_YEARLY_ID ?? ""),
  ]);
  return {
    monthly: monthly ?? pro.amount,
    yearly: yearly ?? pro.yearlyAmount ?? pro.amount,
  };
}

export const getProPricing = unstable_cache(resolveProPricing, ["paddle-pro-pricing"], {
  revalidate: 3600,
});

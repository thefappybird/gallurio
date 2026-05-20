import Stripe from "stripe";
import type { PlanTier } from "@/lib/db/models";

const secret = process.env.STRIPE_SECRET_KEY;

if (!secret && process.env.NODE_ENV !== "test") {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[stripe] STRIPE_SECRET_KEY is not set — billing routes will 500");
  }
}

export const stripe = new Stripe(secret ?? "sk_test_placeholder", {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

const PAID_PLANS = ["starter", "pro"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export function isPaidPlan(plan: PlanTier): plan is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(plan);
}

export function priceIdForPlan(plan: PaidPlan): string {
  const id =
    plan === "starter"
      ? process.env.STRIPE_PRICE_STARTER
      : process.env.STRIPE_PRICE_PRO;
  if (!id) {
    throw new Error(
      `Missing env var STRIPE_PRICE_${plan.toUpperCase()} — set it to the Stripe Price ID for the ${plan} plan`
    );
  }
  return id;
}

export function planForPriceId(priceId: string): PlanTier {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return "free";
}

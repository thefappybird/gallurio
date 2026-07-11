/**
 * Tests for lib/lemonsqueezy/pricing.ts.
 *
 * Lemon Squeezy has no per-country live-pricing-preview API — getProPricing
 * always returns the static PLAN_CATALOG PHP amounts.
 */
import { describe, it, expect } from "vitest";
import { PLAN_CATALOG } from "./plans";
import { getProPricing } from "./pricing";

const pro = PLAN_CATALOG.find((p) => p.id === "pro")!;

describe("getProPricing", () => {
  it("returns the static PLAN_CATALOG pro amounts", async () => {
    const result = await getProPricing();

    expect(result.currency).toBe(pro.currency);
    expect(result.monthly).toBe(pro.amount);
    expect(result.yearly).toBe(pro.yearlyAmount);
  });
});

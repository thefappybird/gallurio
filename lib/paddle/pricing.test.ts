/**
 * Tests for lib/paddle/pricing.ts.
 *
 * getPaddle (Paddle SDK) is mocked — external service. unstable_cache is
 * mocked to an identity passthrough so tests exercise resolveProPricing
 * directly without Next's request-scoped caching internals.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PLAN_CATALOG } from "./plans";

const { mockGetPaddle, mockPricesGet } = vi.hoisted(() => {
  const mockPricesGet = vi.fn();
  const mockGetPaddle = vi.fn(() => ({ prices: { get: mockPricesGet } }));
  return { mockGetPaddle, mockPricesGet };
});

vi.mock("./client", () => ({ getPaddle: mockGetPaddle }));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

import { getProPricing } from "./pricing";

const pro = PLAN_CATALOG.find((p) => p.id === "pro")!;

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PADDLE_PRICE_PRO_ID = "pri_monthly_123";
  process.env.PADDLE_PRICE_PRO_YEARLY_ID = "pri_yearly_456";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getProPricing", () => {
  it("converts unitPrice.amount (smallest unit string) to a decimal PHP amount", async () => {
    mockPricesGet.mockImplementation(async (priceId: string) => {
      if (priceId === "pri_monthly_123") return { unitPrice: { amount: "29900" } };
      if (priceId === "pri_yearly_456") return { unitPrice: { amount: "299900" } };
      throw new Error("unexpected priceId");
    });

    const result = await getProPricing();

    expect(result.monthly).toBe(299);
    expect(result.yearly).toBe(2999);
  });

  it("falls back to PLAN_CATALOG.pro.amount/yearlyAmount when unitPrice.amount is non-numeric", async () => {
    mockPricesGet.mockResolvedValue({ unitPrice: { amount: "not-a-number" } });

    const result = await getProPricing();

    expect(result.monthly).toBe(pro.amount);
    expect(result.yearly).toBe(pro.yearlyAmount);
  });

  it("falls back to PLAN_CATALOG.pro.amount/yearlyAmount when the SDK call rejects", async () => {
    mockPricesGet.mockRejectedValue(new Error("network error"));

    const result = await getProPricing();

    expect(result.monthly).toBe(pro.amount);
    expect(result.yearly).toBe(pro.yearlyAmount);
  });

  it("falls back without calling the SDK when the env var is empty", async () => {
    process.env.PADDLE_PRICE_PRO_ID = "";
    process.env.PADDLE_PRICE_PRO_YEARLY_ID = "";

    const result = await getProPricing();

    expect(result.monthly).toBe(pro.amount);
    expect(result.yearly).toBe(pro.yearlyAmount);
    expect(mockPricesGet).not.toHaveBeenCalled();
    expect(mockGetPaddle).not.toHaveBeenCalled();
  });
});

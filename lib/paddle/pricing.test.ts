/**
 * Tests for lib/paddle/pricing.ts.
 *
 * getPaddle (Paddle SDK) is mocked — external service. unstable_cache is
 * mocked to an identity passthrough so tests exercise resolveProPricing
 * directly without Next's request-scoped caching internals.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PLAN_CATALOG } from "./plans";

const { mockGetPaddle, mockPreview } = vi.hoisted(() => {
  const mockPreview = vi.fn();
  const mockGetPaddle = vi.fn(() => ({ pricingPreview: { preview: mockPreview } }));
  return { mockGetPaddle, mockPreview };
});

const { mockUnstableCache } = vi.hoisted(() => ({
  mockUnstableCache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}));

vi.mock("./client", () => ({ getPaddle: mockGetPaddle }));
vi.mock("next/cache", () => ({ unstable_cache: mockUnstableCache }));

import { getProPricing } from "./pricing";

const pro = PLAN_CATALOG.find((p) => p.id === "pro")!;

const ORIGINAL_ENV = { ...process.env };

function previewResponse(currencyCode: string, monthlyTotal: string, yearlyTotal: string) {
  return {
    currencyCode,
    details: {
      lineItems: [
        { price: { id: "pri_monthly_123" }, unitTotals: { total: monthlyTotal } },
        { price: { id: "pri_yearly_456" }, unitTotals: { total: yearlyTotal } },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUnstableCache.mockImplementation((fn: (...args: unknown[]) => unknown) => fn);
  process.env.PADDLE_PRICE_PRO_ID = "pri_monthly_123";
  process.env.PADDLE_PRICE_PRO_YEARLY_ID = "pri_yearly_456";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getProPricing", () => {
  it("converts unitTotals.total (smallest unit string) to a decimal amount in the preview's currency", async () => {
    mockPreview.mockResolvedValue(previewResponse("USD", "2900", "29900"));

    const result = await getProPricing("US");

    expect(result.currency).toBe("USD");
    expect(result.monthly).toBe(29);
    expect(result.yearly).toBe(299);
    expect(mockPreview).toHaveBeenCalledWith({
      items: [
        { priceId: "pri_monthly_123", quantity: 1 },
        { priceId: "pri_yearly_456", quantity: 1 },
      ],
      address: { countryCode: "US" },
    });
  });

  it("falls back to PLAN_CATALOG.pro.amount/yearlyAmount/currency when a line item total is non-numeric", async () => {
    mockPreview.mockResolvedValue(previewResponse("PHP", "not-a-number", "not-a-number"));

    const result = await getProPricing("PH");

    expect(result.currency).toBe(pro.currency);
    expect(result.monthly).toBe(pro.amount);
    expect(result.yearly).toBe(pro.yearlyAmount);
  });

  it("falls back to PLAN_CATALOG.pro.amount/yearlyAmount/currency when the SDK call rejects", async () => {
    mockPreview.mockRejectedValue(new Error("network error"));

    const result = await getProPricing("PH");

    expect(result.currency).toBe(pro.currency);
    expect(result.monthly).toBe(pro.amount);
    expect(result.yearly).toBe(pro.yearlyAmount);
  });

  it("still resolves pricing when unstable_cache itself throws (e.g. no incrementalCache outside Next's runtime)", async () => {
    mockUnstableCache.mockImplementation(() => {
      throw new Error("Invariant: incrementalCache missing in unstable_cache");
    });
    mockPreview.mockResolvedValue(previewResponse("USD", "2900", "29900"));

    const result = await getProPricing("US");

    expect(result.currency).toBe("USD");
    expect(result.monthly).toBe(29);
    expect(result.yearly).toBe(299);
  });

  it("falls back without calling the SDK when the env var is empty", async () => {
    process.env.PADDLE_PRICE_PRO_ID = "";
    process.env.PADDLE_PRICE_PRO_YEARLY_ID = "";

    const result = await getProPricing("PH");

    expect(result.currency).toBe(pro.currency);
    expect(result.monthly).toBe(pro.amount);
    expect(result.yearly).toBe(pro.yearlyAmount);
    expect(mockPreview).not.toHaveBeenCalled();
    expect(mockGetPaddle).not.toHaveBeenCalled();
  });
});

/**
 * Tests for lib/lemonsqueezy/pricing.ts.
 *
 * getProPricing fetches live Pro variant prices + store currency from Lemon
 * Squeezy, caches the result, and falls back to the static PLAN_CATALOG PHP
 * amounts on any failure.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { PLAN_CATALOG } from "./plans";
import { getProPricing } from "./pricing";

vi.mock("@lemonsqueezy/lemonsqueezy.js", () => ({
  lemonSqueezySetup: vi.fn(),
  createCheckout: vi.fn(),
  getSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  listSubscriptions: vi.fn(),
  getStore: vi.fn(),
  listPrices: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
  vi.resetModules();
});

const pro = PLAN_CATALOG.find((p) => p.id === "pro")!;

describe("getProPricing", () => {
  it("returns the static PLAN_CATALOG pro amounts", async () => {
    const result = await getProPricing();

    expect(result.currency).toBe(pro.currency);
    expect(result.monthly).toBe(pro.amount);
    expect(result.yearly).toBe(pro.yearlyAmount);
  });
});

describe("getProPricing — live pricing", () => {
  it("fetches live monthly/yearly prices and currency from Lemon Squeezy", async () => {
    process.env.LEMONSQUEEZY_API_KEY = "test_key";
    process.env.LEMONSQUEEZY_STORE_ID = "123";
    process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID = "monthly_1";
    process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID = "yearly_1";
    vi.resetModules();

    const ls = await import("@lemonsqueezy/lemonsqueezy.js");
    vi.mocked(ls.getStore).mockResolvedValue({
      statusCode: 200,
      data: { data: { attributes: { currency: "USD" } } },
      error: null,
    } as never);
    vi.mocked(ls.listPrices).mockImplementation(
      (params?: { filter?: { variantId?: string | number } }) => {
        const cents = params?.filter?.variantId === "monthly_1" ? 500 : 5000;
        return Promise.resolve({
          statusCode: 200,
          data: { data: [{ attributes: { unit_price: cents } }] },
          error: null,
        } as never);
      }
    );

    const { getProPricing } = await import("./pricing");
    const result = await getProPricing();

    expect(result).toEqual({ currency: "USD", monthly: 5, yearly: 50 });
  });

  it("caches the live result so a second call within the TTL skips the API", async () => {
    process.env.LEMONSQUEEZY_API_KEY = "test_key";
    process.env.LEMONSQUEEZY_STORE_ID = "123";
    process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID = "monthly_1";
    process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID = "yearly_1";
    vi.resetModules();

    const ls = await import("@lemonsqueezy/lemonsqueezy.js");
    vi.mocked(ls.getStore).mockResolvedValue({
      statusCode: 200,
      data: { data: { attributes: { currency: "USD" } } },
      error: null,
    } as never);
    vi.mocked(ls.listPrices).mockResolvedValue({
      statusCode: 200,
      data: { data: [{ attributes: { unit_price: 500 } }] },
      error: null,
    } as never);

    const { getProPricing } = await import("./pricing");
    await getProPricing();
    await getProPricing();

    expect(ls.getStore).toHaveBeenCalledTimes(1);
  });

  it("falls back to the static PLAN_CATALOG amounts when the Lemon Squeezy API call fails", async () => {
    process.env.LEMONSQUEEZY_API_KEY = "test_key";
    process.env.LEMONSQUEEZY_STORE_ID = "123";
    process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID = "monthly_1";
    process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID = "yearly_1";
    vi.resetModules();

    const ls = await import("@lemonsqueezy/lemonsqueezy.js");
    vi.mocked(ls.getStore).mockRejectedValue(new Error("network down"));
    vi.mocked(ls.listPrices).mockResolvedValue({
      statusCode: 200,
      data: { data: [{ attributes: { unit_price: 500 } }] },
      error: null,
    } as never);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getProPricing } = await import("./pricing");
    const result = await getProPricing();

    expect(result).toEqual({ currency: pro.currency, monthly: pro.amount, yearly: pro.yearlyAmount });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

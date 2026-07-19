/**
 * Tests for the Lemon Squeezy live price/currency fetch helpers in
 * lib/lemonsqueezy/client.ts.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

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

describe("getStoreCurrency", () => {
  it("returns the store's live ISO 4217 currency code", async () => {
    process.env.LEMONSQUEEZY_API_KEY = "test_key";
    process.env.LEMONSQUEEZY_STORE_ID = "123";
    vi.resetModules();

    const ls = await import("@lemonsqueezy/lemonsqueezy.js");
    vi.mocked(ls.getStore).mockResolvedValue({
      statusCode: 200,
      data: { data: { attributes: { currency: "USD" } } },
      error: null,
    } as never);

    const { getStoreCurrency } = await import("./client");
    const currency = await getStoreCurrency();

    expect(currency).toBe("USD");
  });
});

describe("getLatestVariantPriceCents", () => {
  it("returns the variant's current price in cents from its latest Price object", async () => {
    process.env.LEMONSQUEEZY_API_KEY = "test_key";
    vi.resetModules();

    const ls = await import("@lemonsqueezy/lemonsqueezy.js");
    vi.mocked(ls.listPrices).mockResolvedValue({
      statusCode: 200,
      data: { data: [{ attributes: { unit_price: 500 } }] },
      error: null,
    } as never);

    const { getLatestVariantPriceCents } = await import("./client");
    const cents = await getLatestVariantPriceCents("variant_1");

    expect(cents).toBe(500);
  });
});

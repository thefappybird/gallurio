/**
 * getDisplayPricing wraps the live Lemon Squeezy price with a display-only
 * equivalent in the visitor's local currency. Lemon Squeezy always charges the
 * store currency, so the estimate is never authoritative.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const headerStore = { country: null as string | null };

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === "cf-ipcountry" ? headerStore.country : null),
  }),
}));

vi.mock("@/lib/lemonsqueezy/pricing", () => ({
  getProPricing: vi.fn(async () => ({ currency: "PHP", monthly: 250, yearly: 2500 })),
}));

vi.mock("./fxRates", () => ({ getFxRate: vi.fn(async () => 0.0172) }));

beforeEach(() => {
  headerStore.country = null;
});

describe("getDisplayPricing", () => {
  it("converts the Pro price into the visitor's country currency", async () => {
    headerStore.country = "AE";
    vi.mocked((await import("./fxRates")).getFxRate).mockResolvedValue(0.0632);

    const { getDisplayPricing } = await import("./localPricing");
    const pricing = await getDisplayPricing();

    expect(pricing.currency).toBe("PHP");
    expect(pricing.monthly).toBe(250);
    expect(pricing.local).toEqual({
      currency: "AED",
      monthly: 250 * 0.0632,
      yearly: 2500 * 0.0632,
    });
  });

  it("omits the estimate for a visitor already in the store currency", async () => {
    headerStore.country = "PH";
    const fx = vi.mocked((await import("./fxRates")).getFxRate);
    fx.mockClear();

    const { getDisplayPricing } = await import("./localPricing");
    const pricing = await getDisplayPricing();

    expect(pricing.local).toBeUndefined();
    expect(fx).not.toHaveBeenCalled();
  });

  it("falls back to USD when no country header is present", async () => {
    headerStore.country = null;
    vi.mocked((await import("./fxRates")).getFxRate).mockResolvedValue(0.0172);

    const { getDisplayPricing } = await import("./localPricing");
    const pricing = await getDisplayPricing();

    expect(pricing.local?.currency).toBe("USD");
  });

  it("falls back to USD when the visitor's own currency has no rate", async () => {
    headerStore.country = "AE";
    vi.mocked((await import("./fxRates")).getFxRate).mockImplementation(
      async (_base: string, target: string) => (target === "USD" ? 0.0172 : null)
    );

    const { getDisplayPricing } = await import("./localPricing");
    const pricing = await getDisplayPricing();

    expect(pricing.local?.currency).toBe("USD");
  });

  it("omits the estimate when no rate is available", async () => {
    headerStore.country = "US";
    vi.mocked((await import("./fxRates")).getFxRate).mockResolvedValue(null);

    const { getDisplayPricing } = await import("./localPricing");
    const pricing = await getDisplayPricing();

    expect(pricing.local).toBeUndefined();
    expect(pricing.monthly).toBe(250);
  });
});

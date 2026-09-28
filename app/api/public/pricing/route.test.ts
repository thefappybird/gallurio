import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitForTests } from "@/lib/server/rateLimit";

const getDisplayPricingMock = vi.fn();
vi.mock("@/lib/pricing/localPricing", () => ({
  getDisplayPricing: () => getDisplayPricingMock(),
}));

const staticFallbackMock = vi.fn();
vi.mock("@/lib/lemonsqueezy/pricing", () => ({
  staticFallback: (tier: string) => staticFallbackMock(tier),
}));

import { GET } from "./route";

function req(ip = "1.2.3.4", country?: string) {
  const headers: Record<string, string> = { "x-forwarded-for": ip };
  if (country) headers["cf-ipcountry"] = country;
  return new Request("http://localhost/api/public/pricing", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimitForTests();
  delete process.env.BETA_TESTER_ENABLED;
  getDisplayPricingMock.mockResolvedValue({ currency: "PHP", monthly: 250, yearly: 2500 });
  staticFallbackMock.mockReturnValue({ currency: "USD", monthly: 9, yearly: 90 });
});

describe("GET /api/public/pricing", () => {
  it("returns pricing + betaEnabled with a private, short-lived, per-country cache", async () => {
    process.env.BETA_TESTER_ENABLED = "true";

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=300");
    expect(res.headers.get("vary")).toBe("CF-IPCountry");
    await expect(res.json()).resolves.toEqual({
      pricing: { currency: "PHP", monthly: 250, yearly: 2500 },
      betaEnabled: true,
    });
  });

  it("betaEnabled is false when BETA_TESTER_ENABLED is unset", async () => {
    const res = await GET(req("9.9.9.2"));
    const json = await res.json();
    expect(json.betaEnabled).toBe(false);
  });

  it("relies on getDisplayPricing (not its own header parsing) to resolve the visitor's tier from CF-IPCountry", async () => {
    await GET(req("9.9.9.3"));
    expect(getDisplayPricingMock).toHaveBeenCalledTimes(1);
    expect(getDisplayPricingMock).toHaveBeenCalledWith();
  });

  it("never 500s: falls back to the country's own tier when pricing resolution throws", async () => {
    getDisplayPricingMock.mockRejectedValueOnce(new Error("network down"));

    const res = await GET(req("9.9.9.4"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ pricing: { currency: "USD", monthly: 9, yearly: 90 }, betaEnabled: false });
    expect(staticFallbackMock).toHaveBeenCalledWith("base");
  });

  it("resolves the fallback tier from CF-IPCountry instead of always defaulting to base", async () => {
    getDisplayPricingMock.mockRejectedValueOnce(new Error("network down"));

    await GET(req("9.9.9.10", "US"));

    expect(staticFallbackMock).toHaveBeenCalledWith("global");
  });

  it("never caches the error-fallback price — a throttled/erroring visitor must not get a stale wrong-tier price pinned", async () => {
    getDisplayPricingMock.mockRejectedValueOnce(new Error("boom"));

    const res = await GET(req("9.9.9.5"));

    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("throttles a hammering client with a 429 instead of repeatedly resolving live pricing", async () => {
    const ip = "9.9.9.6";
    for (let i = 0; i < 30; i += 1) {
      await GET(req(ip));
    }
    const res = await GET(req(ip));

    expect(res.status).toBe(429);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("retry-after")).not.toBeNull();
    await expect(res.json()).resolves.toEqual({ error: "rate_limited" });
    expect(getDisplayPricingMock.mock.calls.length).toBeLessThan(31);
  });

  it("keys the rate limit on cf-connecting-ip over x-forwarded-for, matching getClientIp's trust order", async () => {
    const make = (xff: string) =>
      new Request("http://localhost/api/public/pricing", {
        headers: { "cf-connecting-ip": "5.5.5.5", "x-forwarded-for": xff },
      });
    for (let i = 0; i < 30; i += 1) {
      await GET(make(`9.9.9.${i}`));
    }

    const res = await GET(make("9.9.9.99"));

    expect(res.status).toBe(429);
  });

  it("does not export POST", async () => {
    const mod = (await import("./route")) as Record<string, unknown>;
    expect(mod.POST).toBeUndefined();
  });
});

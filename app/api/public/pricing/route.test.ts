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

function req(ip = "1.2.3.4") {
  return new Request("http://localhost/api/public/pricing", {
    headers: { "x-forwarded-for": ip },
  });
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

  it("never 500s: falls back to the static base-tier catalog when pricing resolution throws", async () => {
    getDisplayPricingMock.mockRejectedValueOnce(new Error("network down"));

    const res = await GET(req("9.9.9.4"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ pricing: { currency: "USD", monthly: 9, yearly: 90 }, betaEnabled: false });
    expect(staticFallbackMock).toHaveBeenCalledWith("base");
  });

  it("keeps the private per-country cache headers on the fallback path", async () => {
    getDisplayPricingMock.mockRejectedValueOnce(new Error("boom"));

    const res = await GET(req("9.9.9.5"));

    expect(res.headers.get("cache-control")).toBe("private, max-age=300");
    expect(res.headers.get("vary")).toBe("CF-IPCountry");
  });

  it("throttles a hammering client to the static fallback instead of repeatedly resolving live pricing", async () => {
    const ip = "9.9.9.6";
    for (let i = 0; i < 40; i += 1) {
      await GET(req(ip));
    }

    expect(staticFallbackMock).toHaveBeenCalled();
    expect(getDisplayPricingMock.mock.calls.length).toBeLessThan(40);
  });

  it("does not export POST", async () => {
    const mod = (await import("./route")) as Record<string, unknown>;
    expect(mod.POST).toBeUndefined();
  });
});

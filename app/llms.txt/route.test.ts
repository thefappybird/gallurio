import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/lemonsqueezy/pricing", () => ({
  getProPricing: async (tier: "base" | "global") =>
    tier === "global"
      ? { currency: "USD", monthly: 15, yearly: 150 }
      : { currency: "USD", monthly: 5, yearly: 50 },
}));

import { GET } from "./route";

describe("GET /llms.txt", () => {
  it("serves plain text listing every comparison page", async () => {
    const res = await GET();

    expect(res.headers.get("content-type")).toContain("text/plain");
    await expect(res.text()).resolves.toContain("/compare/gallurio-vs-honeybook");
  });

  it("states both live regional prices rather than one obsolete fixed price", async () => {
    const body = await (await GET()).text();

    expect(body).toContain("Base markets: $5 per month or $50 per year.");
    expect(body).toContain("Global markets: $15 per month or $150 per year.");
    expect(body).toContain("Checkout bills the applicable USD tier");
  });

  it("lists the blog content under a Writing section", async () => {
    const body = await (await GET()).text();

    expect(body).toContain("/blog/how-to-price-event-photography-packages");
  });
});

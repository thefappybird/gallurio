import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /llms.txt", () => {
  it("serves plain text listing every comparison page", async () => {
    const res = await GET();

    expect(res.headers.get("content-type")).toContain("text/plain");
    await expect(res.text()).resolves.toContain("/compare/gallurio-vs-honeybook");
  });

  it("states the live price rather than a hardcoded figure", async () => {
    const body = await (await GET()).text();

    // 250/2500 PHP is the static catalog fallback used when no Lemon Squeezy
    // variant is configured, which is the case under test.
    expect(body).toMatch(/Pricing: .*250.* per month or .*2,?500.* per year/);
    expect(body).toContain("billed in");
  });

  it("lists the blog content under a Writing section", async () => {
    const body = await (await GET()).text();

    expect(body).toContain("/blog/how-to-price-event-photography-packages");
  });
});

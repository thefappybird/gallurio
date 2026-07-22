import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { PromoCode } from "@/lib/db/models";

beforeAll(async () => {
  await startInMemoryMongo();
  await PromoCode.createIndexes();
});
afterAll(async () => { await stopInMemoryMongo(); });
afterEach(async () => { await clearCollections(); });

function makeCode(overrides: Record<string, unknown> = {}) {
  return {
    title: "Lifetime Pro",
    code: "lifetime2026",
    type: "lifetime",
    expiresAt: null,
    ...overrides,
  };
}

describe("PromoCode model — basic CRUD", () => {
  it("creates a promo code with required fields", async () => {
    const promo = await PromoCode.create(makeCode());
    expect(promo._id).toBeDefined();
    expect(promo.code).toBe("lifetime2026");
    expect(promo.type).toBe("lifetime");
  });

  it("lowercases code on write", async () => {
    const promo = await PromoCode.create(makeCode({ code: "MYCODE" }));
    expect(promo.code).toBe("mycode");
  });

  it("rejects a missing type", async () => {
    await expect(
      PromoCode.create({ title: "No type", code: "notype1" })
    ).rejects.toThrow();
  });
});

describe("PromoCode model — beta2mo type", () => {
  it("accepts beta2mo as a valid type", async () => {
    const promo = await PromoCode.create(makeCode({ code: "beta2mocode", type: "beta2mo" }));
    expect(promo.type).toBe("beta2mo");
  });
});

describe("PromoCode model — demo1mo type", () => {
  it("accepts demo1mo as a valid type", async () => {
    const promo = await PromoCode.create(makeCode({ code: "demo1mocode", type: "demo1mo" }));
    expect(promo.type).toBe("demo1mo");
  });
});

describe("PromoCode model — code uniqueness", () => {
  it("rejects a duplicate code across different casing", async () => {
    await PromoCode.create(makeCode({ code: "dupecode" }));
    await expect(
      PromoCode.create(makeCode({ code: "DUPECODE", title: "Dupe 2" }))
    ).rejects.toThrow();
  });
});

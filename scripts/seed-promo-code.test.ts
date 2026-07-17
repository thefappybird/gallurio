import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { PromoCode } from "@/lib/db/models";
import { parseArgs, seedPromoCode } from "./seed-promo-code";

const SECRET_CODE = "SUPERSECRET-BETA2MO-42";

describe("parseArgs", () => {
  it("parses a generic promo with an optional expiry", () => {
    expect(parseArgs(["--code=abc", "--title=Promo", "--type=monthly", "--expires-at=2027-01-01"])).toEqual({
      code: "abc",
      title: "Promo",
      type: "monthly",
      expiresAt: new Date("2027-01-01"),
      dryRun: false,
    });
  });

  it("defaults dryRun to false when absent", () => {
    expect(parseArgs(["--code=abc", "--title=Beta Promo"])).toEqual({
      code: "abc",
      title: "Beta Promo",
      type: undefined,
      expiresAt: undefined,
      dryRun: false,
    });
  });
});

describe("seedPromoCode", () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  }, 120_000);

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it("creates a chosen promo type with null expiresAt/revokedAt", async () => {
    const result = await seedPromoCode(SECRET_CODE, "Lifetime promo", "lifetime");
    expect(result).toEqual({ created: true, title: "Lifetime promo" });

    const doc = await PromoCode.findOne({ code: SECRET_CODE.toLowerCase() }).lean();
    expect(doc).not.toBeNull();
    expect(doc?.type).toBe("lifetime");
    expect(doc?.expiresAt).toBeNull();
    expect(doc?.revokedAt).toBeNull();
    expect(doc?.code).toBe(SECRET_CODE.toLowerCase());
  });

  it("is idempotent: a second call with the same code does not duplicate or error", async () => {
    await seedPromoCode(SECRET_CODE, "Lifetime promo", "lifetime");
    const second = await seedPromoCode(SECRET_CODE, "Lifetime promo", "lifetime");
    expect(second.created).toBe(false);

    const count = await PromoCode.countDocuments({ code: SECRET_CODE.toLowerCase() });
    expect(count).toBe(1);
  });

  it("matches an existing code case-insensitively (lowercased/trimmed)", async () => {
    await seedPromoCode(SECRET_CODE, "Lifetime promo", "lifetime");
    const second = await seedPromoCode(`  ${SECRET_CODE.toUpperCase()}  `, "Lifetime promo", "lifetime");
    expect(second.created).toBe(false);

    const count = await PromoCode.countDocuments({});
    expect(count).toBe(1);
  });

  it("dry-run performs no write", async () => {
    const result = await seedPromoCode(SECRET_CODE, "Lifetime promo", "lifetime", { dryRun: true });
    expect(result.created).toBe(false);

    const count = await PromoCode.countDocuments({});
    expect(count).toBe(0);
  });
});

describe("code redaction", () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  }, 120_000);

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never logs the raw promo code, even across create + idempotent no-op paths", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await seedPromoCode(SECRET_CODE, "Lifetime promo", "lifetime");
    await seedPromoCode(SECRET_CODE, "Lifetime promo", "lifetime");

    const allOutput = [...logSpy.mock.calls, ...errSpy.mock.calls, ...warnSpy.mock.calls]
      .map((call) => call.join(" "))
      .join("\n");

    expect(allOutput).not.toContain(SECRET_CODE);
    expect(allOutput).not.toContain(SECRET_CODE.toLowerCase());
  });
});

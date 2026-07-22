import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PromoCode } from "@/lib/db/models";
import { clearCollections, startInMemoryMongo, stopInMemoryMongo } from "@/test-utils/mongo";
import { seedBasePromos } from "./seed-base-promos";

describe("seedBasePromos", () => {
  beforeAll(async () => startInMemoryMongo(), 120_000);
  afterAll(async () => stopInMemoryMongo());
  afterEach(async () => clearCollections());

  it("creates exactly the five standard promos, including the post-beta and demo offers, and is idempotent", async () => {
    await expect(seedBasePromos()).resolves.toEqual({ created: 5, existing: 0 });
    await expect(seedBasePromos()).resolves.toEqual({ created: 0, existing: 5 });
    expect(await PromoCode.countDocuments()).toBe(5);
  });

  it("does not write in dry-run mode", async () => {
    await expect(seedBasePromos({ dryRun: true })).resolves.toEqual({ created: 5, existing: 0 });
    expect(await PromoCode.countDocuments()).toBe(0);
  });
});

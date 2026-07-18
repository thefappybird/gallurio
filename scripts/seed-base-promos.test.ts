import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PromoCode } from "@/lib/db/models";
import { clearCollections, startInMemoryMongo, stopInMemoryMongo } from "@/test-utils/mongo";
import { seedBasePromos } from "./seed-base-promos";

describe("seedBasePromos", () => {
  beforeAll(async () => startInMemoryMongo(), 120_000);
  afterAll(async () => stopInMemoryMongo());
  afterEach(async () => clearCollections());

  it("creates exactly the four standard promos, including the post-beta offer, and is idempotent", async () => {
    await expect(seedBasePromos()).resolves.toEqual({ created: 4, existing: 0 });
    await expect(seedBasePromos()).resolves.toEqual({ created: 0, existing: 4 });
    expect(await PromoCode.countDocuments()).toBe(4);
  });

  it("does not write in dry-run mode", async () => {
    await expect(seedBasePromos({ dryRun: true })).resolves.toEqual({ created: 4, existing: 0 });
    expect(await PromoCode.countDocuments()).toBe(0);
  });
});

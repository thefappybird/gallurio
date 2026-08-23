import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { FxRateTable, FxFetchLock } from "./FxRateTable";

beforeAll(async () => {
  await startInMemoryMongo();
}, 120_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
});

describe("FxRateTable model", () => {
  it("creates a document keyed by the UTC day with a rates map", async () => {
    const doc = await FxRateTable.create({
      _id: "2026-08-21",
      base: "USD",
      rates: { USD: 1, PHP: 58 },
      fetchedAt: new Date("2026-08-21T00:15:00Z"),
    });

    expect(doc._id).toBe("2026-08-21");
    expect(doc.rates.PHP).toBe(58);
  });

  it("sorts the latest day first with _id: -1", async () => {
    await FxRateTable.create({
      _id: "2026-08-19",
      base: "USD",
      rates: { USD: 1 },
      fetchedAt: new Date("2026-08-19T00:15:00Z"),
    });
    await FxRateTable.create({
      _id: "2026-08-21",
      base: "USD",
      rates: { USD: 1 },
      fetchedAt: new Date("2026-08-21T00:15:00Z"),
    });
    await FxRateTable.create({
      _id: "2026-08-20",
      base: "USD",
      rates: { USD: 1 },
      fetchedAt: new Date("2026-08-20T00:15:00Z"),
    });

    const latest = await FxRateTable.findOne().sort({ _id: -1 }).limit(1).lean();
    expect(latest?._id).toBe("2026-08-21");
  });
});

describe("FxFetchLock model", () => {
  it("upserts a single lock row keyed by a fixed id", async () => {
    await FxFetchLock.findOneAndUpdate(
      { _id: "fx-fetch-lock" },
      { $set: { lockedUntil: new Date("2026-08-21T00:01:00Z") } },
      { upsert: true }
    );

    const count = await FxFetchLock.countDocuments();
    expect(count).toBe(1);
  });
});

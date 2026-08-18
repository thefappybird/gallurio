/**
 * Compound indexes backing the currency roll-up queries added in
 * lib/pricing/workspaceRates.ts and lib/pricing/clientTotals.ts. Asserts the
 * exact key order Mongo needs to satisfy each query shape without a
 * collection scan.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo } from "@/test-utils/mongo";
import { Booking, Transaction } from "@/lib/db/models";

beforeAll(async () => {
  await startInMemoryMongo();
  // Model.init() resolves once autoIndex has finished building — without it,
  // collection.indexes() can race the background index build.
  await Promise.all([Booking.init(), Transaction.init()]);
}, 120_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

function hasIndex(indexes: { key: Record<string, number> }[], key: Record<string, number>) {
  return indexes.some((i) => JSON.stringify(i.key) === JSON.stringify(key));
}

describe("currency roll-up indexes", () => {
  it("Transaction has a {workspaceId, currency} index", async () => {
    const indexes = await Transaction.collection.indexes();
    expect(hasIndex(indexes, { workspaceId: 1, currency: 1 })).toBe(true);
  });

  it("Transaction has a {workspaceId, clientId} index", async () => {
    const indexes = await Transaction.collection.indexes();
    expect(hasIndex(indexes, { workspaceId: 1, clientId: 1 })).toBe(true);
  });

  it("Booking has a {workspaceId, amount.currency} index", async () => {
    const indexes = await Booking.collection.indexes();
    expect(hasIndex(indexes, { workspaceId: 1, "amount.currency": 1 })).toBe(true);
  });
});

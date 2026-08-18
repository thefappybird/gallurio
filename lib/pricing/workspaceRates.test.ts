/**
 * getWorkspaceRateMap discovers which currencies a workspace's money is
 * actually stored in and resolves one multiplier per currency into the
 * workspace currency. Uses real collections (never mock Mongoose).
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";

const getFxRateMock = vi.fn();
vi.mock("./fxRates", () => ({ getFxRate: (...args: unknown[]) => getFxRateMock(...args) }));

const WORKSPACE_ID = new mongoose.Types.ObjectId();

beforeAll(async () => {
  await startInMemoryMongo();
}, 120_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
  getFxRateMock.mockReset();
});

describe("getWorkspaceRateMap", () => {
  it("skips the FX lookup when every amount is already in the workspace currency", async () => {
    const { Booking } = await import("@/lib/db/models");
    await Booking.collection.insertMany([
      { workspaceId: WORKSPACE_ID, amount: { total: 100, currency: "PHP" } },
    ]);

    const { getWorkspaceRateMap } = await import("./workspaceRates");
    const map = await getWorkspaceRateMap(WORKSPACE_ID, "PHP");

    expect(map).toEqual({ PHP: 1 });
    expect(getFxRateMock).not.toHaveBeenCalled();
  });

  it("resolves a rate for every foreign currency the workspace stores", async () => {
    getFxRateMock.mockImplementation(async (from: string) =>
      from === "USD" ? 58 : from === "AED" ? 15.8 : null
    );
    // Own workspace id (not WORKSPACE_ID) so the memoization cache added
    // below doesn't serve this test the previous test's cached PHP-only map.
    const ws = new mongoose.Types.ObjectId();
    const { Booking, Transaction } = await import("@/lib/db/models");
    await Booking.collection.insertMany([
      { workspaceId: ws, amount: { total: 100, currency: "USD" } },
    ]);
    await Transaction.collection.insertMany([
      { workspaceId: ws, amount: 20, currency: "AED" },
    ]);

    const { getWorkspaceRateMap } = await import("./workspaceRates");
    const map = await getWorkspaceRateMap(ws, "PHP");

    expect(map).toEqual({ PHP: 1, USD: 58, AED: 15.8 });
  });

  it("never includes a currency that only another workspace stores", async () => {
    getFxRateMock.mockImplementation(async (from: string) => (from === "EUR" ? 65 : null));
    const otherWorkspaceId = new mongoose.Types.ObjectId();
    const { Booking } = await import("@/lib/db/models");
    await Booking.collection.insertMany([
      { workspaceId: otherWorkspaceId, amount: { total: 100, currency: "EUR" } },
    ]);

    const { getWorkspaceRateMap } = await import("./workspaceRates");
    const map = await getWorkspaceRateMap(WORKSPACE_ID, "PHP");

    expect(map).toEqual({ PHP: 1 });
    expect(map.EUR).toBeUndefined();
  });
});

describe("getWorkspaceRateMap — memoization", () => {
  it("does not re-query distinct currencies on a second call within the TTL", async () => {
    const ws = new mongoose.Types.ObjectId();
    const { Booking, Transaction } = await import("@/lib/db/models");
    await Booking.collection.insertMany([
      { workspaceId: ws, amount: { total: 100, currency: "PHP" } },
    ]);
    const bookingDistinctSpy = vi.spyOn(Booking, "distinct");
    const transactionDistinctSpy = vi.spyOn(Transaction, "distinct");

    const { getWorkspaceRateMap } = await import("./workspaceRates");
    await getWorkspaceRateMap(ws, "PHP");
    await getWorkspaceRateMap(ws, "PHP");

    expect(bookingDistinctSpy).toHaveBeenCalledTimes(1);
    expect(transactionDistinctSpy).toHaveBeenCalledTimes(1);
  });
});

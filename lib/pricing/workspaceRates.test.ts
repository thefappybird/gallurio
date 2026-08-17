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
    const { Booking, Transaction } = await import("@/lib/db/models");
    await Booking.collection.insertMany([
      { workspaceId: WORKSPACE_ID, amount: { total: 100, currency: "USD" } },
    ]);
    await Transaction.collection.insertMany([
      { workspaceId: WORKSPACE_ID, amount: 20, currency: "AED" },
    ]);

    const { getWorkspaceRateMap } = await import("./workspaceRates");
    const map = await getWorkspaceRateMap(WORKSPACE_ID, "PHP");

    expect(map).toEqual({ PHP: 1, USD: 58, AED: 15.8 });
  });
});

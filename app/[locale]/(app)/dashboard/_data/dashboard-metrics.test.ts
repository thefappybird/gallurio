import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Client, Transaction } from "@/lib/db/models";
import { getKpiSnapshot, getTopClients } from "./dashboard-metrics";

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
});

describe("getTopClients", () => {
  it("returns only _id, name, and totalSpent (projected, not the full Client doc)", async () => {
    const ws = new Types.ObjectId();
    await Client.create({
      workspaceId: ws,
      name: "Studio Aurora",
      email: "studio@example.com",
      totalSpent: 5000,
      transactions: [
        {
          bookingId: new Types.ObjectId(),
          amount: 5000,
          type: "deposit",
          occurredAt: new Date(),
          source: "manual",
        },
      ],
    });

    const [top] = await getTopClients(ws, 5);

    expect(top.name).toBe("Studio Aurora");
    expect(top.totalSpent).toBe(5000);
    expect((top as Record<string, unknown>).email).toBeUndefined();
    expect((top as Record<string, unknown>).transactions).toBeUndefined();
  });
});

describe("getKpiSnapshot — multi-currency roll-up", () => {
  it("converts foreign-currency transactions into the workspace currency before summing", async () => {
    const ws = new Types.ObjectId();
    const paidAt = new Date();
    await Transaction.create([
      { workspaceId: ws, amount: 1000, currency: "PHP", type: "deposit", method: "cash", paidAt },
      { workspaceId: ws, amount: 10, currency: "USD", type: "balance", method: "cash", paidAt },
    ]);

    const snapshot = await getKpiSnapshot(ws, { PHP: 1, USD: 58 });

    expect(snapshot.revenueThisMonth).toBe(1000 + 10 * 58);
  });
});

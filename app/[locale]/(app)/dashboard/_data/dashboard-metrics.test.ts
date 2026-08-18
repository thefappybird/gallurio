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

describe("getTopClients — multi-currency roll-up", () => {
  it("ranks and totals clients in the workspace currency, not by the raw stored field", async () => {
    const ws = new Types.ObjectId();
    const local = await Client.create({ workspaceId: ws, name: "Local Studio", totalSpent: 9_000 });
    const overseas = await Client.create({
      workspaceId: ws,
      name: "Overseas Studio",
      totalSpent: 200,
    });

    await Transaction.create([
      {
        workspaceId: ws,
        clientId: local._id,
        amount: 9_000,
        currency: "PHP",
        type: "deposit",
        method: "cash",
      },
      {
        workspaceId: ws,
        clientId: overseas._id,
        amount: 200,
        currency: "USD",
        type: "deposit",
        method: "cash",
      },
    ]);

    const top = await getTopClients(ws, 5, { PHP: 1, USD: 58 });

    // ₱9,000 vs $200 ≈ ₱11,600 — the overseas client outranks the local one
    // once converted, the opposite of the raw stored ordering.
    expect(top.map((c) => c.name)).toEqual(["Overseas Studio", "Local Studio"]);
    expect(top[0].totalSpent).toBe(200 * 58);
  });

  it("never ranks another workspace's clients", async () => {
    const ws = new Types.ObjectId();
    const otherWs = new Types.ObjectId();
    const otherClient = await Client.create({
      workspaceId: otherWs,
      name: "Other Workspace Client",
      totalSpent: 999_999,
    });
    await Transaction.create([
      {
        workspaceId: otherWs,
        clientId: otherClient._id,
        amount: 999_999,
        currency: "USD",
        type: "deposit",
      },
    ]);

    const top = await getTopClients(ws, 5, { PHP: 1, USD: 58 });

    expect(top.map((c) => c.name)).not.toContain("Other Workspace Client");
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

  it("computes outstandingBalance across mismatched booking and transaction currencies", async () => {
    const ws = new Types.ObjectId();
    const { Booking } = await import("@/lib/db/models");
    const booking = await Booking.create({
      workspaceId: ws,
      teamId: new Types.ObjectId(),
      clientId: new Types.ObjectId(),
      clientName: "Test Client",
      title: "Test Booking",
      status: "booked",
      sessions: [{ startAt: new Date(), endAt: new Date(Date.now() + 3_600_000) }],
      firstSessionStart: new Date(),
      lastSessionEnd: new Date(Date.now() + 3_600_000),
      amount: { total: 100, deposit: 0, currency: "USD" },
    });
    await Transaction.create([
      {
        workspaceId: ws,
        bookingId: booking._id,
        amount: 1000,
        currency: "PHP",
        type: "deposit",
        method: "cash",
      },
    ]);

    const snapshot = await getKpiSnapshot(ws, { PHP: 1, USD: 58 });

    expect(snapshot.outstandingBalance).toBe(100 * 58 - 1000);
  });
});

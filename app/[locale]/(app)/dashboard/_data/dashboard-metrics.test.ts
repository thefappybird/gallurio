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

    const top = await getTopClients(ws, 5, { rates: { PHP: 1, USD: 58 }, target: "PHP" });

    // ₱9,000 vs $200 ≈ ₱11,600 — the overseas client outranks the local one
    // once converted, the opposite of the raw stored ordering.
    expect(top.map((c) => c.name)).toEqual(["Overseas Studio", "Local Studio"]);
    expect(top[0].totalSpent).toBe(200 * 58);
  });

  it("still returns `limit` rows when a ranked client's Client doc is missing but a lower-ranked one can backfill", async () => {
    const ws = new Types.ObjectId();
    // 6 clients ranked 1..6 by spend; rank 3's Client doc gets deleted after
    // its transaction is recorded (simulates a stale/orphaned ledger row).
    const clients = await Client.create(
      [1, 2, 3, 4, 5, 6].map((n) => ({ workspaceId: ws, name: `Client ${n}`, totalSpent: 0 }))
    );
    await Transaction.create(
      clients.map((c, i) => ({
        workspaceId: ws,
        clientId: c._id,
        amount: (6 - i) * 1000, // Client 1 highest, Client 6 lowest
        currency: "PHP",
        type: "deposit",
        method: "cash",
      }))
    );
    await Client.deleteOne({ _id: clients[2]._id }); // rank 3 ("Client 3")

    const top = await getTopClients(ws, 5, { rates: { PHP: 1, USD: 58 }, target: "PHP" });

    expect(top).toHaveLength(5);
    expect(top.map((c) => c.name)).toEqual(["Client 1", "Client 2", "Client 4", "Client 5", "Client 6"]);
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

    const top = await getTopClients(ws, 5, { rates: { PHP: 1, USD: 58 }, target: "PHP" });

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

    const snapshot = await getKpiSnapshot(ws, { rates: { PHP: 1, USD: 58 }, target: "PHP" });

    expect(snapshot.revenueThisMonth).toBe(1000 + 10 * 58);
  });

  it("sums a frozen transaction at its frozen rate, not today's live rate", async () => {
    const ws = new Types.ObjectId();
    const paidAt = new Date();
    await Transaction.create([
      {
        workspaceId: ws,
        amount: 10,
        currency: "USD",
        type: "deposit",
        method: "cash",
        paidAt,
        fxRate: 55,
        fxTarget: "PHP",
      },
    ]);

    const snapshot = await getKpiSnapshot(ws, { rates: { PHP: 1, USD: 58 }, target: "PHP" });

    expect(snapshot.revenueThisMonth).toBe(10 * 55);
  });

  it("scheduled Booking totals stay live-converted even when a frozen fx field is present on the booking", async () => {
    const ws = new Types.ObjectId();
    const { Booking } = await import("@/lib/db/models");
    await Booking.create({
      workspaceId: ws,
      teamId: new Types.ObjectId(),
      clientId: new Types.ObjectId(),
      clientName: "Test Client",
      title: "Test Booking",
      status: "booked",
      sessions: [{ startAt: new Date(), endAt: new Date(Date.now() + 3_600_000) }],
      firstSessionStart: new Date(),
      lastSessionEnd: new Date(Date.now() + 3_600_000),
      // amount.fxRate/fxTarget would normally only be set once a payment
      // freezes them — asserting the scheduled total ignores them even if
      // present guards against ever wiring the Booking side onto frozen rates.
      amount: { total: 100, deposit: 0, currency: "USD", fxRate: 999, fxTarget: "PHP" },
    });

    const snapshot = await getKpiSnapshot(ws, { rates: { PHP: 1, USD: 58 }, target: "PHP" });

    // 100 * live(58), never 100 * frozen(999).
    expect(snapshot.outstandingBalance).toBe(100 * 58);
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

    const snapshot = await getKpiSnapshot(ws, { rates: { PHP: 1, USD: 58 }, target: "PHP" });

    expect(snapshot.outstandingBalance).toBe(100 * 58 - 1000);
  });
});

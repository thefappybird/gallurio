import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Client, Transaction } from "@/lib/db/models";
import {
  recordBookingForClient,
  reassignBookingBetweenClients,
  syncBookingPaymentsForClient,
} from "./clientTransactions";

const WS_ID = new Types.ObjectId();
const WS_A = new Types.ObjectId();
const WS_B = new Types.ObjectId();
const CLIENT_ID = new Types.ObjectId();
const BOOKING_ID = new Types.ObjectId();

async function makeClient(overrides: Record<string, unknown> = {}) {
  return Client.create({
    _id: CLIENT_ID,
    workspaceId: WS_ID,
    name: "Test Client",
    email: "test@example.com",
    source: "manual",
    ...overrides,
  });
}

const BASE_BOOKING = {
  _id: BOOKING_ID,
  amount: { total: 50_000, deposit: 10_000, currency: "PHP" },
  firstSessionStart: new Date("2026-06-15T09:00:00.000Z"),
};

beforeAll(async () => {
  await startInMemoryMongo();
}, 90_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
});

describe("recordBookingForClient", () => {
  it("creates a Transaction doc and updates client counters for a new client", async () => {
    await makeClient();

    await recordBookingForClient({
      workspaceId: WS_ID,
      clientId: CLIENT_ID,
      booking: BASE_BOOKING,
      source: "manual",
    });

    const tx = await Transaction.findOne({ workspaceId: WS_ID, bookingId: BOOKING_ID }).lean();
    expect(tx).not.toBeNull();
    expect(tx?.type).toBe("deposit");
    expect(tx?.amount).toBe(10_000);
    expect(tx?.method).toBe("other");

    const client = await Client.findById(CLIENT_ID).lean();
    expect(client?.totalSpent).toBe(10_000);
    expect(client?.bookingsCount).toBe(1);
    expect(client?.lastPaymentAmount).toBe(10_000);
    expect(client?.lastPaymentDate?.toISOString()).toBe("2026-06-15T09:00:00.000Z");
    expect(client?.transactions).toHaveLength(1);
    expect(client?.transactions?.[0]?.type).toBe("deposit");
    expect(client?.transactions?.[0]?.source).toBe("manual");
  });

  it("denormalizes the booking's teamId onto the Transaction and the history entry", async () => {
    await makeClient();
    const teamId = new Types.ObjectId();

    await recordBookingForClient({
      workspaceId: WS_ID,
      clientId: CLIENT_ID,
      booking: { ...BASE_BOOKING, teamId },
      source: "manual",
    });

    const tx = await Transaction.findOne({ workspaceId: WS_ID, bookingId: BOOKING_ID }).lean();
    expect(String(tx?.teamId)).toBe(String(teamId));

    const client = await Client.findById(CLIENT_ID).lean();
    expect(String(client?.transactions?.[0]?.teamId)).toBe(String(teamId));
  });

  it("skips Transaction creation when deposit is 0, records history entry with type=other", async () => {
    await makeClient();

    const booking = {
      _id: BOOKING_ID,
      amount: { total: 30_000, deposit: 0, currency: "PHP" },
      firstSessionStart: new Date("2026-07-01T10:00:00.000Z"),
    };

    await recordBookingForClient({
      workspaceId: WS_ID,
      clientId: CLIENT_ID,
      booking,
      source: "import",
    });

    const tx = await Transaction.findOne({ bookingId: BOOKING_ID }).lean();
    expect(tx).toBeNull();

    const client = await Client.findById(CLIENT_ID).lean();
    expect(client?.bookingsCount).toBe(1);
    expect(client?.lastBookingAt?.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(client?.totalSpent ?? 0).toBe(0);
    expect(client?.lastPaymentAmount ?? 0).toBe(0);
    expect(client?.lastPaymentDate ?? null).toBeNull();
    expect(client?.transactions).toHaveLength(1);
    expect(client?.transactions?.[0]?.type).toBe("other");
    expect(client?.transactions?.[0]?.amount).toBe(0);
    expect(client?.transactions?.[0]?.transactionId).toBeNull();
  });

  it("appends to existing transactions without duplicating", async () => {
    await makeClient({ totalSpent: 5_000, bookingsCount: 1 });

    const booking2Id = new Types.ObjectId();
    await recordBookingForClient({
      workspaceId: WS_ID,
      clientId: CLIENT_ID,
      booking: {
        _id: booking2Id,
        amount: { total: 20_000, deposit: 8_000, currency: "PHP" },
        firstSessionStart: new Date("2026-08-10T09:00:00.000Z"),
      },
      source: "seed",
    });

    const client = await Client.findById(CLIENT_ID).lean();
    expect(client?.totalSpent).toBe(13_000);
    expect(client?.bookingsCount).toBe(2);
    expect(client?.transactions).toHaveLength(1);
    expect(client?.transactions?.[0]?.bookingId?.toString()).toBe(booking2Id.toString());
  });

  it("enforces $slice cap of 200 entries", async () => {
    await makeClient();

    for (let i = 0; i < 201; i++) {
      await recordBookingForClient({
        workspaceId: WS_ID,
        clientId: CLIENT_ID,
        booking: {
          _id: new Types.ObjectId(),
          amount: { total: 1_000, deposit: 500, currency: "PHP" },
          firstSessionStart: new Date(`2026-01-${String(i % 28 + 1).padStart(2, "0")}T09:00:00.000Z`),
        },
        source: "seed",
      });
    }

    const client = await Client.findById(CLIENT_ID).lean();
    expect(client?.transactions?.length).toBe(200);
    expect(client?.bookingsCount).toBe(201);
  });

  it("throws when client is not found", async () => {
    const fakeClientId = new Types.ObjectId();
    await expect(
      recordBookingForClient({
        workspaceId: WS_ID,
        clientId: fakeClientId,
        booking: BASE_BOOKING,
        source: "manual",
      })
    ).rejects.toThrow("client not found");
  });

  it("rejects cross-workspace client and does NOT create an orphaned Transaction", async () => {
    const clientA = await Client.create({ workspaceId: WS_A, name: "A", source: "manual" });
    await expect(
      recordBookingForClient({
        workspaceId: WS_B,
        clientId: clientA._id,
        booking: {
          _id: new Types.ObjectId(),
          amount: { total: 1000, deposit: 500, currency: "PHP" },
          firstSessionStart: new Date(),
        },
        source: "import",
      })
    ).rejects.toThrow(/client not found/);

    const orphanCount = await Transaction.countDocuments({});
    expect(orphanCount).toBe(0);
  });

  // P1-9: back-dated booking must NOT regress $max fields or overwrite the
  // lastPaymentAmount that belongs to a newer payment.
  it("back-dated booking does not regress lastBookingAt, lastPaymentDate, or lastPaymentAmount", async () => {
    await makeClient();

    // First call — newer date, larger deposit.
    await recordBookingForClient({
      workspaceId: WS_ID,
      clientId: CLIENT_ID,
      booking: {
        _id: new Types.ObjectId(),
        amount: { total: 10_000, deposit: 5_000, currency: "PHP" },
        firstSessionStart: new Date("2026-08-10T10:00:00Z"),
      },
      source: "manual",
    });

    // Second call — older date, smaller deposit (back-dated import).
    await recordBookingForClient({
      workspaceId: WS_ID,
      clientId: CLIENT_ID,
      booking: {
        _id: new Types.ObjectId(),
        amount: { total: 5_000, deposit: 1_000, currency: "PHP" },
        firstSessionStart: new Date("2026-06-01T10:00:00Z"),
      },
      source: "import",
    });

    const client = await Client.findById(CLIENT_ID).lean();

    // lastBookingAt must remain the later date.
    expect(client?.lastBookingAt?.toISOString()).toBe("2026-08-10T10:00:00.000Z");
    // lastPaymentDate must remain the later date.
    expect(client?.lastPaymentDate?.toISOString()).toBe("2026-08-10T10:00:00.000Z");
    // lastPaymentAmount must reflect the newer entry (5000), not the back-dated one (1000).
    expect(client?.lastPaymentAmount).toBe(5_000);
    // Both bookings contributed to totals.
    expect(client?.totalSpent).toBe(6_000);
    expect(client?.bookingsCount).toBe(2);
  });

  // P1-11: transaction rollback on partial-write failure.
  // Transaction.create rolls back when Client.updateOne fails inside
  // withTransaction — the txn abort leaves 0 Transaction docs.
  it("rolls back Transaction.create when Client.updateOne throws (no orphaned Transaction doc)", async () => {
    await makeClient();

    const spy = vi
      .spyOn(Client, "updateOne")
      .mockRejectedValueOnce(new Error("forced"));

    await expect(
      recordBookingForClient({
        workspaceId: WS_ID,
        clientId: CLIENT_ID,
        booking: {
          _id: new Types.ObjectId(),
          amount: { total: 10_000, deposit: 5_000, currency: "PHP" },
          firstSessionStart: new Date("2026-08-10T10:00:00Z"),
        },
        source: "manual",
      })
    ).rejects.toThrow("forced");

    // The transaction must have rolled back: Transaction.create ran inside
    // the same session so the aborted txn persists 0 documents.
    const count = await Transaction.countDocuments({});
    expect(count).toBe(0);

    spy.mockRestore();
  });
});

describe("reassignBookingBetweenClients", () => {
  const FROM_CLIENT_ID = new Types.ObjectId();
  const TO_CLIENT_ID = new Types.ObjectId();
  const REASSIGN_BOOKING_ID = new Types.ObjectId();
  const REASSIGN_START = new Date("2026-09-01T10:00:00Z");

  const BASE_REASSIGN_BOOKING = {
    _id: REASSIGN_BOOKING_ID,
    amount: { total: 50_000, deposit: 10_000, currency: "PHP" },
    firstSessionStart: REASSIGN_START,
  };

  async function seedFromClient(overrides: Record<string, unknown> = {}) {
    return Client.create({
      _id: FROM_CLIENT_ID,
      workspaceId: WS_ID,
      name: "From Client",
      source: "manual",
      bookingsCount: 1,
      totalSpent: 10_000,
      lastBookingAt: REASSIGN_START,
      ...overrides,
    });
  }

  async function seedToClient(overrides: Record<string, unknown> = {}) {
    return Client.create({
      _id: TO_CLIENT_ID,
      workspaceId: WS_ID,
      name: "To Client",
      source: "manual",
      bookingsCount: 0,
      totalSpent: 0,
      ...overrides,
    });
  }

  it("decrements from-client and increments to-client counters atomically", async () => {
    await seedFromClient();
    await seedToClient();

    // Seed an existing Transaction for the from-client.
    await Transaction.create({
      workspaceId: WS_ID,
      bookingId: REASSIGN_BOOKING_ID,
      clientId: FROM_CLIENT_ID,
      amount: 10_000,
      currency: "PHP",
      type: "deposit",
      method: "other",
      paidAt: REASSIGN_START,
    });

    await reassignBookingBetweenClients({
      workspaceId: WS_ID,
      fromClientId: FROM_CLIENT_ID,
      toClientId: TO_CLIENT_ID,
      booking: BASE_REASSIGN_BOOKING,
    });

    const from = await Client.findById(FROM_CLIENT_ID).lean();
    expect(from?.totalSpent).toBe(0);
    expect(from?.bookingsCount).toBe(0);

    const to = await Client.findById(TO_CLIENT_ID).lean();
    expect(to?.totalSpent).toBe(10_000);
    expect(to?.bookingsCount).toBe(1);

    // Old Transaction removed; new one created for to-client.
    const oldTx = await Transaction.findOne({ bookingId: REASSIGN_BOOKING_ID, clientId: FROM_CLIENT_ID }).lean();
    expect(oldTx).toBeNull();
    const newTx = await Transaction.findOne({ bookingId: REASSIGN_BOOKING_ID, clientId: TO_CLIENT_ID }).lean();
    expect(newTx).not.toBeNull();
    expect(newTx?.amount).toBe(10_000);
  });

  it("works when deposit is 0 (no Transaction doc involved)", async () => {
    await seedFromClient({ totalSpent: 0 });
    await seedToClient();

    await reassignBookingBetweenClients({
      workspaceId: WS_ID,
      fromClientId: FROM_CLIENT_ID,
      toClientId: TO_CLIENT_ID,
      booking: {
        _id: REASSIGN_BOOKING_ID,
        amount: { total: 30_000, deposit: 0, currency: "PHP" },
        firstSessionStart: REASSIGN_START,
      },
    });

    const from = await Client.findById(FROM_CLIENT_ID).lean();
    expect(from?.bookingsCount).toBe(0);

    const to = await Client.findById(TO_CLIENT_ID).lean();
    expect(to?.bookingsCount).toBe(1);

    const txCount = await Transaction.countDocuments({});
    expect(txCount).toBe(0);
  });

  it("carries the booking's teamId onto the moved transaction + history entry", async () => {
    await seedFromClient();
    await seedToClient();
    await Transaction.create({
      workspaceId: WS_ID,
      bookingId: REASSIGN_BOOKING_ID,
      clientId: FROM_CLIENT_ID,
      amount: 10_000,
      currency: "PHP",
      type: "deposit",
      method: "other",
      paidAt: REASSIGN_START,
    });
    const teamId = new Types.ObjectId();

    await reassignBookingBetweenClients({
      workspaceId: WS_ID,
      fromClientId: FROM_CLIENT_ID,
      toClientId: TO_CLIENT_ID,
      booking: { ...BASE_REASSIGN_BOOKING, teamId },
    });

    const tx = await Transaction.findOne({
      workspaceId: WS_ID,
      bookingId: REASSIGN_BOOKING_ID,
      clientId: TO_CLIENT_ID,
    }).lean();
    expect(String(tx?.teamId)).toBe(String(teamId));

    const to = await Client.findById(TO_CLIENT_ID).lean();
    expect(String(to?.transactions?.[0]?.teamId)).toBe(String(teamId));
  });

  it("throws when fromClient is not found", async () => {
    await seedToClient();
    await expect(
      reassignBookingBetweenClients({
        workspaceId: WS_ID,
        fromClientId: new Types.ObjectId(),
        toClientId: TO_CLIENT_ID,
        booking: BASE_REASSIGN_BOOKING,
      })
    ).rejects.toThrow(/fromClient not found/);
  });

  it("throws when toClient is not found", async () => {
    await seedFromClient();
    await expect(
      reassignBookingBetweenClients({
        workspaceId: WS_ID,
        fromClientId: FROM_CLIENT_ID,
        toClientId: new Types.ObjectId(),
        booking: BASE_REASSIGN_BOOKING,
      })
    ).rejects.toThrow(/toClient not found/);
  });

  it("rejects cross-workspace toClient (workspace isolation)", async () => {
    const wsA = new Types.ObjectId();
    const wsB = new Types.ObjectId();
    const fromClientA = await Client.create({ workspaceId: wsA, name: "A", source: "manual", bookingsCount: 1, totalSpent: 5_000 });
    const toClientB = await Client.create({ workspaceId: wsB, name: "B", source: "manual" });

    await expect(
      reassignBookingBetweenClients({
        workspaceId: wsA,
        fromClientId: fromClientA._id,
        toClientId: toClientB._id,
        booking: BASE_REASSIGN_BOOKING,
      })
    ).rejects.toThrow(/toClient not found/);
  });

  // Issue 6 — stale summary fields on old client after reassignment.
  it("recomputes lastBookingAt to the remaining booking when the most-recent booking is moved", async () => {
    const olderStart = new Date("2026-07-01T09:00:00Z");
    const newerStart = new Date("2026-09-01T10:00:00Z"); // REASSIGN_START — the one we move

    const olderBookingId = new Types.ObjectId();

    await Client.create({
      _id: FROM_CLIENT_ID,
      workspaceId: WS_ID,
      name: "From Client",
      source: "manual",
      bookingsCount: 2,
      totalSpent: 15_000,
      lastBookingAt: newerStart,
      lastPaymentDate: newerStart,
      lastPaymentAmount: 10_000,
      transactions: [
        {
          bookingId: olderBookingId,
          transactionId: null,
          amount: 5_000,
          currency: "PHP",
          type: "deposit",
          occurredAt: olderStart,
          source: "manual",
        },
        {
          bookingId: REASSIGN_BOOKING_ID,
          transactionId: null,
          amount: 10_000,
          currency: "PHP",
          type: "deposit",
          occurredAt: newerStart,
          source: "manual",
        },
      ],
    });
    await seedToClient();

    await reassignBookingBetweenClients({
      workspaceId: WS_ID,
      fromClientId: FROM_CLIENT_ID,
      toClientId: TO_CLIENT_ID,
      booking: BASE_REASSIGN_BOOKING,
    });

    const from = await Client.findById(FROM_CLIENT_ID).lean();
    // After moving the Sept booking, only the July one remains.
    expect(from?.lastBookingAt?.toISOString()).toBe(olderStart.toISOString());
    expect(from?.lastPaymentDate?.toISOString()).toBe(olderStart.toISOString());
    expect(from?.lastPaymentAmount).toBe(5_000);
    expect(from?.bookingsCount).toBe(1);
    expect(from?.transactions).toHaveLength(1);
    expect(from?.transactions?.[0]?.bookingId?.toString()).toBe(olderBookingId.toString());
  });

  it("sets lastBookingAt, lastPaymentDate, and lastPaymentAmount to null when the only booking is moved", async () => {
    await Client.create({
      _id: FROM_CLIENT_ID,
      workspaceId: WS_ID,
      name: "From Client",
      source: "manual",
      bookingsCount: 1,
      totalSpent: 10_000,
      lastBookingAt: REASSIGN_START,
      lastPaymentDate: REASSIGN_START,
      lastPaymentAmount: 10_000,
      transactions: [
        {
          bookingId: REASSIGN_BOOKING_ID,
          transactionId: null,
          amount: 10_000,
          currency: "PHP",
          type: "deposit",
          occurredAt: REASSIGN_START,
          source: "manual",
        },
      ],
    });
    await seedToClient();

    // Seed the corresponding Transaction doc so deleteOne finds it.
    await Transaction.create({
      workspaceId: WS_ID,
      bookingId: REASSIGN_BOOKING_ID,
      clientId: FROM_CLIENT_ID,
      amount: 10_000,
      currency: "PHP",
      type: "deposit",
      method: "other",
      paidAt: REASSIGN_START,
    });

    await reassignBookingBetweenClients({
      workspaceId: WS_ID,
      fromClientId: FROM_CLIENT_ID,
      toClientId: TO_CLIENT_ID,
      booking: BASE_REASSIGN_BOOKING,
    });

    const from = await Client.findById(FROM_CLIENT_ID).lean();
    expect(from?.transactions).toHaveLength(0);
    expect(from?.lastBookingAt ?? null).toBeNull();
    expect(from?.lastPaymentDate ?? null).toBeNull();
    expect(from?.lastPaymentAmount ?? null).toBeNull();
    expect(from?.bookingsCount).toBe(0);
  });

  it("recomputes correctly for zero-deposit booking (type=other entries)", async () => {
    const olderStart = new Date("2026-06-10T08:00:00Z");
    const newerStart = new Date("2026-09-01T10:00:00Z");
    const olderBookingId = new Types.ObjectId();

    await Client.create({
      _id: FROM_CLIENT_ID,
      workspaceId: WS_ID,
      name: "From Client",
      source: "manual",
      bookingsCount: 2,
      totalSpent: 0,
      lastBookingAt: newerStart,
      lastPaymentDate: null,
      lastPaymentAmount: null,
      transactions: [
        {
          bookingId: olderBookingId,
          transactionId: null,
          amount: 0,
          currency: "PHP",
          type: "other",
          occurredAt: olderStart,
          source: "manual",
        },
        {
          bookingId: REASSIGN_BOOKING_ID,
          transactionId: null,
          amount: 0,
          currency: "PHP",
          type: "other",
          occurredAt: newerStart,
          source: "manual",
        },
      ],
    });
    await seedToClient();

    await reassignBookingBetweenClients({
      workspaceId: WS_ID,
      fromClientId: FROM_CLIENT_ID,
      toClientId: TO_CLIENT_ID,
      booking: {
        _id: REASSIGN_BOOKING_ID,
        amount: { total: 0, deposit: 0, currency: "PHP" },
        firstSessionStart: newerStart,
      },
    });

    const from = await Client.findById(FROM_CLIENT_ID).lean();
    expect(from?.lastBookingAt?.toISOString()).toBe(olderStart.toISOString());
    // No payment-type entries remain — payment fields stay null.
    expect(from?.lastPaymentDate ?? null).toBeNull();
    expect(from?.lastPaymentAmount ?? null).toBeNull();
    expect(from?.bookingsCount).toBe(1);
  });
});

describe("recordBookingForClient — fx copy", () => {
  it("copies the booking amount's frozen fx fields onto the deposit Transaction", async () => {
    await makeClient();
    const fxAt = new Date("2026-06-01T00:00:00.000Z");

    await recordBookingForClient({
      workspaceId: WS_ID,
      clientId: CLIENT_ID,
      booking: {
        ...BASE_BOOKING,
        amount: { total: 50_000, deposit: 10_000, currency: "USD", fxRate: 58.25, fxTarget: "PHP", fxAt },
      },
      source: "manual",
    });

    const tx = await Transaction.findOne({ workspaceId: WS_ID, bookingId: BOOKING_ID }).lean();
    expect(tx?.fxRate).toBe(58.25);
    expect(tx?.fxTarget).toBe("PHP");
    expect(tx?.fxAt?.toISOString()).toBe(fxAt.toISOString());
  });
});

describe("syncBookingPaymentsForClient — fx copy", () => {
  it("copies a paid payment's frozen fx fields onto the derived balance Transaction", async () => {
    await makeClient();
    const fxAt = new Date("2026-06-10T00:00:00.000Z");

    await syncBookingPaymentsForClient({
      workspaceId: WS_ID,
      clientId: CLIENT_ID,
      booking: {
        _id: BOOKING_ID,
        amount: { currency: "USD" },
        payments: [
          {
            price: 100,
            status: "paid",
            fxRate: 58.25,
            fxTarget: "PHP",
            fxAt,
          },
        ],
      },
    });

    const tx = await Transaction.findOne({ workspaceId: WS_ID, type: "balance" }).lean();
    expect(tx?.fxRate).toBe(58.25);
    expect(tx?.fxTarget).toBe("PHP");
    expect(tx?.fxAt?.toISOString()).toBe(fxAt.toISOString());
  });
});

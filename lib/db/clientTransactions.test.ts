import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Client, Transaction } from "@/lib/db/models";
import { recordBookingForClient } from "./clientTransactions";

const WS_ID = new Types.ObjectId();
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
});
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

  it("uses total amount and type=other when deposit is 0", async () => {
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
    expect(tx?.type).toBe("other");
    expect(tx?.amount).toBe(30_000);

    const client = await Client.findById(CLIENT_ID).lean();
    expect(client?.totalSpent).toBe(30_000);
    expect(client?.transactions?.[0]?.type).toBe("other");
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
          amount: { total: 1_000, deposit: 0, currency: "PHP" },
          firstSessionStart: new Date(`2026-01-${String(i % 28 + 1).padStart(2, "0")}T09:00:00.000Z`),
        },
        source: "seed",
      });
    }

    const client = await Client.findById(CLIENT_ID).lean();
    expect(client?.transactions?.length).toBe(200);
    expect(client?.bookingsCount).toBe(201);
  });

  it("throws and logs when client is not found", async () => {
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
});

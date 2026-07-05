import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Booking } from "@/lib/db/models";
import { Types } from "mongoose";

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
afterEach(async () => { await clearCollections(); });

function baseBooking(overrides: Record<string, unknown> = {}) {
  const start = new Date("2026-08-15T10:00:00Z");
  return {
    workspaceId: new Types.ObjectId(),
    clientId: new Types.ObjectId(),
    clientName: "Test Client",
    title: "Test Booking",
    sessions: [{ startAt: start, endAt: start }],
    firstSessionStart: start,
    lastSessionEnd: start,
    ...overrides,
  };
}

describe("Booking model — payments", () => {
  it("defaults payments to an empty array", async () => {
    const b = await Booking.create(baseBooking());
    expect(b.payments).toEqual([]);
  });

  it("rejects a payment with a negative price", async () => {
    await expect(
      Booking.create(
        baseBooking({
          payments: [{ price: -10, status: "unpaid", createdAt: new Date() }],
        })
      )
    ).rejects.toThrow();
  });

  it("rejects a payment with a status outside unpaid/paid", async () => {
    await expect(
      Booking.create(
        baseBooking({
          payments: [{ price: 10, status: "refunded", createdAt: new Date() }],
        })
      )
    ).rejects.toThrow();
  });

  it("rejects a payment missing createdAt", async () => {
    await expect(
      Booking.create(
        baseBooking({
          payments: [{ price: 10, status: "unpaid" }],
        })
      )
    ).rejects.toThrow();
  });

  it("defaults a payment's status to unpaid when omitted", async () => {
    const b = await Booking.create(
      baseBooking({
        payments: [{ price: 10, createdAt: new Date() }],
      })
    );
    expect(b.payments[0].status).toBe("unpaid");
  });

  it("casts a payment's paidAt to a Date when given an ISO string", async () => {
    const b = await Booking.create(
      baseBooking({
        payments: [
          { price: 10, status: "paid", createdAt: new Date(), paidAt: "2026-01-01T00:00:00.000Z" },
        ],
      })
    );
    expect(b.payments[0].paidAt).toBeInstanceOf(Date);
  });

  it("casts a payment's createdAt to a Date when given an ISO string", async () => {
    const b = await Booking.create(
      baseBooking({
        payments: [{ price: 10, status: "unpaid", createdAt: "2026-01-01T00:00:00.000Z" }],
      })
    );
    expect(b.payments[0].createdAt).toBeInstanceOf(Date);
  });

  it("casts a payment's price to a Number when given a numeric string", async () => {
    const b = await Booking.create(
      baseBooking({
        payments: [{ price: "10", status: "unpaid", createdAt: new Date() }],
      })
    );
    expect(b.payments[0].price).toBe(10);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, ActivityLog } from "@/lib/db/models";
import {
  listBookings,
  getBookingById,
  getBookingActivity,
} from "./bookings-queries";

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
const clientId = new Types.ObjectId();

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
});

function days(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function seedBooking(
  wid: Types.ObjectId,
  overrides: Partial<{
    title: string;
    clientName: string;
    status: string;
    startAt: Date;
    location: { address: string };
  }> = {}
) {
  const start = overrides.startAt ?? days(1);
  return Booking.create({
    workspaceId: wid,
    clientId,
    clientName: overrides.clientName ?? "Demo Client",
    title: overrides.title ?? "Demo Booking",
    status: overrides.status ?? "booked",
    sessions: [{ startAt: start, endAt: start }],
    firstSessionStart: start,
    lastSessionEnd: start,
    location: overrides.location ?? { address: "" },
    amount: { total: 50_000, deposit: 10_000, currency: "PHP" },
  });
}

describe("listBookings", () => {
  it("returns bookings sorted ascending by firstSessionStart", async () => {
    await seedBooking(workspaceId, { startAt: days(5) });
    await seedBooking(workspaceId, { startAt: days(1) });
    await seedBooking(workspaceId, { startAt: days(3) });

    const { rows, total } = await listBookings(workspaceId);
    expect(rows).toHaveLength(3);
    expect(total).toBe(3);
    expect(rows[0].firstSessionStart.getTime()).toBeLessThan(rows[1].firstSessionStart.getTime());
    expect(rows[1].firstSessionStart.getTime()).toBeLessThan(rows[2].firstSessionStart.getTime());
  });

  it("excludes cancelled by default", async () => {
    await seedBooking(workspaceId, { status: "booked" });
    await seedBooking(workspaceId, { status: "cancelled" });

    const { rows } = await listBookings(workspaceId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("booked");
  });

  it("includes cancelled when includeCancelled is true", async () => {
    await seedBooking(workspaceId, { status: "booked" });
    await seedBooking(workspaceId, { status: "cancelled" });

    const { rows } = await listBookings(workspaceId, { includeCancelled: true });
    expect(rows).toHaveLength(2);
  });

  it("filters by exact status", async () => {
    await seedBooking(workspaceId, { status: "quoted" });
    await seedBooking(workspaceId, { status: "booked" });
    await seedBooking(workspaceId, { status: "inquiry" });

    const { rows } = await listBookings(workspaceId, { status: "quoted" });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("quoted");
  });

  it("filters by date range via firstSessionStart (inclusive)", async () => {
    await seedBooking(workspaceId, { startAt: days(-5) });
    await seedBooking(workspaceId, { startAt: days(5) });
    await seedBooking(workspaceId, { startAt: days(15) });

    const { rows } = await listBookings(workspaceId, {
      from: days(0),
      to: days(10),
    });
    expect(rows).toHaveLength(1);
  });

  it("searches across title, clientName, and location.address (case-insensitive)", async () => {
    await seedBooking(workspaceId, {
      title: "Carter Wedding",
      clientName: "Emma Carter",
    });
    await seedBooking(workspaceId, {
      title: "Shah Engagement",
      clientName: "Priya Shah",
    });
    await seedBooking(workspaceId, {
      title: "Generic",
      location: { address: "100 carter Ave" },
    });

    const { rows } = await listBookings(workspaceId, { q: "carter" });
    expect(rows).toHaveLength(2);
  });

  it("escapes regex special chars in search", async () => {
    await seedBooking(workspaceId, { title: "Wedding (Outdoor)" });
    const { rows } = await listBookings(workspaceId, { q: "Wedding (Outdoor)" });
    expect(rows).toHaveLength(1);
  });

  it("never leaks another workspace's bookings", async () => {
    await seedBooking(otherWorkspaceId, { title: "Other org" });
    const { rows } = await listBookings(workspaceId);
    expect(rows).toHaveLength(0);
  });

  it("returns paginated rows and accurate total when pagination is passed", async () => {
    for (let i = 0; i < 15; i++) {
      await seedBooking(workspaceId, { startAt: days(i + 1) });
    }

    const page1 = await listBookings(workspaceId, {}, { page: 1, limit: 10 });
    expect(page1.rows).toHaveLength(10);
    expect(page1.total).toBe(15);

    const page2 = await listBookings(workspaceId, {}, { page: 2, limit: 10 });
    expect(page2.rows).toHaveLength(5);
    expect(page2.total).toBe(15);
  });

  it("returns total matching the filter, not the page size", async () => {
    await seedBooking(workspaceId, { status: "booked", startAt: days(1) });
    await seedBooking(workspaceId, { status: "booked", startAt: days(2) });
    await seedBooking(workspaceId, { status: "quoted", startAt: days(3) });

    const { rows, total } = await listBookings(
      workspaceId,
      { status: "booked" },
      { page: 1, limit: 1 }
    );
    expect(rows).toHaveLength(1);
    expect(total).toBe(2);
  });
});

describe("getBookingById", () => {
  it("returns the doc when the workspace matches", async () => {
    const b = await seedBooking(workspaceId, { title: "T" });
    const found = await getBookingById(workspaceId, b._id);
    expect(found?.title).toBe("T");
  });

  it("returns null for a doc belonging to another workspace (tenant isolation)", async () => {
    const b = await seedBooking(otherWorkspaceId);
    const found = await getBookingById(workspaceId, b._id);
    expect(found).toBeNull();
  });

  it("returns null for a non-existent id", async () => {
    const found = await getBookingById(workspaceId, new Types.ObjectId());
    expect(found).toBeNull();
  });
});

describe("getBookingActivity", () => {
  it("returns booking-scoped activity sorted newest first", async () => {
    const b = await seedBooking(workspaceId);
    await ActivityLog.create({
      workspaceId,
      actorUserId: "user_1",
      entity: "booking",
      entityId: b._id,
      action: "created",
    });
    await ActivityLog.create({
      workspaceId,
      actorUserId: "user_1",
      entity: "booking",
      entityId: b._id,
      action: "updated",
    });
    // Noise: different entity + different workspace
    await ActivityLog.create({
      workspaceId,
      actorUserId: "user_1",
      entity: "client",
      entityId: clientId,
      action: "created",
    });
    await ActivityLog.create({
      workspaceId: otherWorkspaceId,
      actorUserId: "user_x",
      entity: "booking",
      entityId: b._id,
      action: "created",
    });

    const log = await getBookingActivity(workspaceId, b._id);
    expect(log).toHaveLength(2);
    expect(log[0].action).toBe("updated");
    expect(log[1].action).toBe("created");
  });
});

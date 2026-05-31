import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Inquiry, Booking, Client } from "@/lib/db/models";
import {
  listInquiries,
  getInquiryStatusCounts,
  getInquiryById,
  getInquiryWithDraft,
} from "./inquiries";

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

async function seedInquiry(
  wid: Types.ObjectId,
  overrides: Partial<{
    name: string;
    email: string;
    status: string;
    eventType: string;
    createdAt: Date;
  }> = {}
) {
  // Insert via the raw driver so we control createdAt exactly — Mongoose's
  // `timestamps` plugin overwrites a create()/updateOne() createdAt with "now".
  const createdAt = overrides.createdAt ?? new Date();
  const res = await Inquiry.collection.insertOne({
    workspaceId: wid,
    name: overrides.name ?? "Emma Carter",
    email: overrides.email ?? "emma@example.com",
    status: overrides.status ?? "new",
    eventType: overrides.eventType ?? "wedding",
    createdAt,
    updatedAt: createdAt,
  });
  return { _id: res.insertedId };
}

describe("listInquiries", () => {
  it("returns inquiries newest-first", async () => {
    await seedInquiry(workspaceId, { createdAt: new Date("2026-01-01") });
    await seedInquiry(workspaceId, { createdAt: new Date("2026-03-01") });
    await seedInquiry(workspaceId, { createdAt: new Date("2026-02-01") });

    const { rows, total } = await listInquiries(workspaceId);
    expect(total).toBe(3);
    expect(rows[0].createdAt.getTime()).toBeGreaterThan(rows[1].createdAt.getTime());
  });

  it("filters by status", async () => {
    await seedInquiry(workspaceId, { status: "new" });
    await seedInquiry(workspaceId, { status: "converted" });

    const { rows } = await listInquiries(workspaceId, { status: "converted" });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("converted");
  });

  it("ignores an invalid status value", async () => {
    await seedInquiry(workspaceId, { status: "new" });
    const { rows } = await listInquiries(workspaceId, { status: "bogus" });
    expect(rows).toHaveLength(1);
  });

  it("filters by createdAt date range", async () => {
    await seedInquiry(workspaceId, { createdAt: new Date("2026-01-01") });
    await seedInquiry(workspaceId, { createdAt: new Date("2026-06-15") });
    await seedInquiry(workspaceId, { createdAt: new Date("2026-12-31") });

    const { rows } = await listInquiries(workspaceId, {
      from: new Date("2026-05-01"),
      to: new Date("2026-07-01"),
    });
    expect(rows).toHaveLength(1);
  });

  it("never leaks another workspace's inquiries", async () => {
    await seedInquiry(otherWorkspaceId);
    const { rows } = await listInquiries(workspaceId);
    expect(rows).toHaveLength(0);
  });

  it("paginates with an accurate total", async () => {
    for (let i = 0; i < 7; i += 1) await seedInquiry(workspaceId);
    const p1 = await listInquiries(workspaceId, {}, { page: 1, limit: 5 });
    expect(p1.rows).toHaveLength(5);
    expect(p1.total).toBe(7);
    const p2 = await listInquiries(workspaceId, {}, { page: 2, limit: 5 });
    expect(p2.rows).toHaveLength(2);
  });
});

describe("getInquiryStatusCounts", () => {
  it("counts per status and totals only real statuses", async () => {
    await seedInquiry(workspaceId, { status: "new" });
    await seedInquiry(workspaceId, { status: "new" });
    await seedInquiry(workspaceId, { status: "contacted" });
    await seedInquiry(workspaceId, { status: "converted" });
    await seedInquiry(otherWorkspaceId, { status: "new" });

    const counts = await getInquiryStatusCounts(workspaceId);
    expect(counts).toEqual({ new: 2, contacted: 1, converted: 1, archived: 0, all: 4 });
  });
});

describe("getInquiryById", () => {
  it("returns the inquiry for the owning workspace", async () => {
    const i = await seedInquiry(workspaceId);
    const found = await getInquiryById(workspaceId, i._id);
    expect(found?.name).toBe("Emma Carter");
  });

  it("returns null for another workspace's inquiry (tenant isolation)", async () => {
    const i = await seedInquiry(otherWorkspaceId);
    const found = await getInquiryById(workspaceId, i._id);
    expect(found).toBeNull();
  });
});

describe("getInquiryWithDraft", () => {
  it("loads the inquiry plus its linked draft booking", async () => {
    const client = await Client.create({ workspaceId, name: "Emma", source: "form" });
    const start = new Date("2030-08-15T02:00:00Z");
    const booking = await Booking.create({
      workspaceId,
      clientId: client._id,
      clientName: "Emma",
      title: "Emma — inquiry",
      status: "draft",
      sessions: [{ startAt: start, endAt: start }],
      firstSessionStart: start,
      lastSessionEnd: start,
      amount: { total: 0, deposit: 0, currency: "PHP" },
    });
    const inquiry = await Inquiry.create({
      workspaceId,
      name: "Emma",
      email: "emma@example.com",
      status: "new",
      clientId: client._id,
      draftBookingId: booking._id,
    });

    const res = await getInquiryWithDraft(workspaceId, inquiry._id);
    expect(res).not.toBeNull();
    expect(res!.booking?.status).toBe("draft");
    expect(String(res!.inquiry._id)).toBe(String(inquiry._id));
  });

  it("returns a null booking when no draft is linked", async () => {
    const inquiry = await seedInquiry(workspaceId);
    const res = await getInquiryWithDraft(workspaceId, inquiry._id);
    expect(res!.booking).toBeNull();
  });

  it("returns null entirely for a cross-workspace inquiry", async () => {
    const inquiry = await seedInquiry(otherWorkspaceId);
    const res = await getInquiryWithDraft(workspaceId, inquiry._id);
    expect(res).toBeNull();
  });
});

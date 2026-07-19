import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, Client } from "@/lib/db/models";

const receiptDocumentMock = vi.hoisted(() => vi.fn((_arg: unknown) => "mock-element"));
vi.mock("@/lib/invoices/ReceiptDocument", () => ({
  ReceiptDocument: (arg: unknown) => receiptDocumentMock(arg),
}));
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: async () => Buffer.from("%PDF-mock"),
}));

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
const userId = "user_test";

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId,
    role: "owner",
    workspace: {
      _id: workspaceId,
      name: "Test Studio",
      logoUrl: "",
      contact: { email: "owner@studio.test", address: "123 Main St" },
      invoiceTheme: { preset: "classic", main: "#1A1A1A", accent: "#FFFFFF" },
    },
  }),
}));

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  receiptDocumentMock.mockClear();
});

async function load() {
  return import("./route");
}

async function seedClient(wid: Types.ObjectId, overrides: Record<string, unknown> = {}) {
  return Client.create({
    workspaceId: wid,
    name: "Emma Carter",
    email: "emma@example.com",
    phone: "+639171234567",
    source: "manual",
    ...overrides,
  });
}

async function seedBooking(
  wid: Types.ObjectId,
  clientId: Types.ObjectId,
  overrides: Record<string, unknown> = {}
) {
  const start = new Date("2026-08-15T10:00:00Z");
  const end = new Date("2026-08-15T14:00:00Z");
  return Booking.create({
    workspaceId: wid,
    clientId,
    clientName: "Emma Carter",
    title: "Carter Wedding",
    eventType: "wedding",
    status: "completed",
    sessions: [{ startAt: start, endAt: end }],
    firstSessionStart: start,
    lastSessionEnd: end,
    location: { address: "Pier 27, Manila" },
    amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
    payments: [{ price: 50_000, status: "paid", createdAt: new Date(), paidAt: new Date() }],
    ...overrides,
  });
}

function makeGet(id: string) {
  return new Request(`http://test/api/bookings/${id}/receipt`, { method: "GET" });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/bookings/[id]/receipt", () => {
  it("returns 400 for an invalid id", async () => {
    const { GET } = await load();
    const res = await GET(makeGet("not-an-id"), ctx("not-an-id"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the booking belongs to another workspace (tenant isolation)", async () => {
    const c = await seedClient(otherWorkspaceId);
    const b = await seedBooking(otherWorkspaceId, c._id);
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(404);
  });

  it("returns 400 when the booking is not completed", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, { status: "booked" });
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("receipt_not_available");
  });

  it("returns a PDF for a completed booking with correct headers and filename", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="TEST-STUDIO-EMMA-CARTER-RECEIPT_\d{4}-\d{2}-\d{2}\.PDF"$/
    );
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("passes deposit and an itemized payments breakdown (with title) to ReceiptDocument", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, {
      payments: [{ price: 50_000, status: "paid", title: "Final payment", createdAt: new Date(), paidAt: new Date() }],
    });
    const { GET } = await load();
    await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(receiptDocumentMock).toHaveBeenCalledTimes(1);
    const { data } = receiptDocumentMock.mock.calls[0][0] as {
      data: { amount: { deposit: number; payments: { title: string; price: number }[] } };
    };
    expect(data.amount.deposit).toBe(25_000);
    expect(data.amount.payments).toEqual([
      expect.objectContaining({ title: "Final payment", price: 50_000 }),
    ]);
  });
});

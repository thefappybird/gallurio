import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, Client } from "@/lib/db/models";

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
      publicPage: { brandKit: { accentColor: "#2f5d56" } },
      invoiceTheme: { preset: "navyGold", main: "#0F1B33", accent: "#C9A24B" },
    },
  }),
}));

const invoiceDocumentSpy = vi.fn();
vi.mock("@/lib/invoices/InvoiceDocument", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/invoices/InvoiceDocument")>();
  return {
    ...actual,
    InvoiceDocument: (args: unknown) => {
      invoiceDocumentSpy(args);
      return actual.InvoiceDocument(args as never);
    },
  };
});

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
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
  return new Request(`http://test/api/bookings/${id}/invoice`, { method: "GET" });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/bookings/[id]/invoice", () => {
  it("returns 400 for an invalid id", async () => {
    const { GET } = await load();
    const res = await GET(makeGet("not-an-id"), ctx("not-an-id"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a nonexistent booking", async () => {
    const { GET } = await load();
    const id = new Types.ObjectId().toString();
    const res = await GET(makeGet(id), ctx(id));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the booking belongs to another workspace (tenant isolation)", async () => {
    const c = await seedClient(otherWorkspaceId);
    const b = await seedBooking(otherWorkspaceId, c._id);
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(404);
  });

  it("returns 400 when the booking has no payment activity, even if completed", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, { status: "completed", payments: [] });
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invoice_not_available");
  });

  it("returns a PDF for a completed booking with correct headers", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="TEST-STUDIO-EMMA-CARTER-INVOICE_\d{4}-\d{2}-\d{2}\.PDF"$/
    );
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("returns a PDF for a booked (not yet completed) booking that has payment activity", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, { status: "booked" });
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("allocates an invoiceNumber once and reuses it across consecutive downloads", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { GET } = await load();
    await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    const after1 = await Booking.findById(b._id).lean();
    expect(after1?.invoiceNumber).toMatch(/^INV-\d{6}$/);
    await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    const after2 = await Booking.findById(b._id).lean();
    expect(after2?.invoiceNumber).toBe(after1?.invoiceNumber);
  });

  it("resolves the workspace's invoiceTheme into the document's business.theme", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { GET } = await load();
    invoiceDocumentSpy.mockClear();
    await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(invoiceDocumentSpy).toHaveBeenCalledTimes(1);
    const passedData = invoiceDocumentSpy.mock.calls[0][0] as { data: { business: { theme?: unknown; accentColor?: unknown } } };
    expect(passedData.data.business.theme).toEqual({ main: "#0F1B33", accent: "#C9A24B" });
    expect(passedData.data.business.accentColor).toBeUndefined();
  });

  it("falls back to booking.clientName when the client doc is missing (hard-deleted)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    await Client.deleteOne({ _id: c._id });
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, Client } from "@/lib/db/models";

const WS_ID = new Types.ObjectId();

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId: "user_test",
    clerkOrgId: "org_test",
    role: "owner",
    workspace: { _id: WS_ID, currency: "PHP", name: "Test", slug: "t" },
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
});

async function callImport(rows: unknown[]) {
  const { POST } = await import("./route");
  const req = new Request("http://localhost/api/bookings/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  return POST(req);
}

const VALID_ROW = {
  title: "Smith Wedding",
  clientName: "Jane Smith",
  clientEmail: "jane@example.com",
  startAt: "2026-06-15T09:00:00.000Z",
  eventType: "wedding",
  status: "booked",
  amountTotal: 50000,
  amountDeposit: 10000,
  currency: "PHP",
};

describe("POST /api/bookings/import", () => {
  it("creates a booking and client for a valid row", async () => {
    const res = await callImport([VALID_ROW]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(1);
    expect(body.errors).toHaveLength(0);

    const booking = await Booking.findOne({ workspaceId: WS_ID }).lean();
    expect(booking?.title).toBe("Smith Wedding");
    expect(booking?.status).toBe("booked");

    const client = await Client.findOne({ workspaceId: WS_ID }).lean();
    expect(client?.email).toBe("jane@example.com");
    expect(client?.source).toBe("import");
  });

  it("reuses an existing client when email matches", async () => {
    const existing = await Client.create({
      workspaceId: WS_ID,
      name: "Jane Smith",
      email: "jane@example.com",
      source: "manual",
    });

    await callImport([VALID_ROW]);

    const clients = await Client.find({ workspaceId: WS_ID });
    expect(clients).toHaveLength(1);
    expect(clients[0]._id.toString()).toBe(existing._id.toString());
  });

  it("deduplicates client creation when same email appears twice in one import", async () => {
    const row2 = { ...VALID_ROW, title: "Smith Engagement" };
    await callImport([VALID_ROW, row2]);

    const clients = await Client.find({ workspaceId: WS_ID });
    expect(clients).toHaveLength(1);

    const bookings = await Booking.find({ workspaceId: WS_ID });
    expect(bookings).toHaveLength(2);
  });

  it("creates booking without client email", async () => {
    const rowWithoutEmail = { ...VALID_ROW, clientEmail: undefined };
    const res = await callImport([rowWithoutEmail]);
    const body = await res.json();
    expect(body.created).toBe(1);

    const client = await Client.findOne({ workspaceId: WS_ID }).lean();
    expect(client?.email).toBeNull();
    expect(client?.source).toBe("import");
  });

  it("returns error for row missing required title", async () => {
    const noTitle = { ...VALID_ROW, title: undefined };
    const res = await callImport([noTitle]);
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].index).toBe(0);
  });

  it("returns 422 when every row fails", async () => {
    const res = await callImport([{ title: "", clientName: "", startAt: "bad" }]);
    expect(res.status).toBe(422);
  });

  it("partial success: creates valid rows and reports errors for invalid ones", async () => {
    const badRow = { title: "", clientName: "X", startAt: "not-a-date" };
    const res = await callImport([VALID_ROW, badRow]);
    const body = await res.json();
    expect(body.created).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].index).toBe(1);
    expect(res.status).toBe(200);
  });

  it("rejects empty rows array", async () => {
    const res = await callImport([]);
    expect(res.status).toBe(400);
  });

  it("rejects more than 500 rows", async () => {
    const rows = Array.from({ length: 501 }, () => VALID_ROW);
    const res = await callImport(rows);
    expect(res.status).toBe(400);
  });
});

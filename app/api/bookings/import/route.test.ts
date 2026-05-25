import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type MockInstance } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, Client, Transaction } from "@/lib/db/models";
import * as clientTransactions from "@/lib/db/clientTransactions";

const WS_ID = new Types.ObjectId();
const WS_A = new Types.ObjectId();
const WS_B = new Types.ObjectId();

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

// requireOrg is mocked as a vi.fn() so individual tests can override the
// returned workspace context without re-importing the route module.
const mockRequireOrg = vi.fn();
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: (...args: unknown[]) => mockRequireOrg(...args),
}));

function makeOrgCtx(wsId: Types.ObjectId) {
  return {
    userId: "user_test",
    clerkOrgId: `org_${wsId.toHexString()}`,
    role: "owner" as const,
    workspace: { _id: wsId, currency: "PHP", name: "Test", slug: "t" },
  };
}

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  // Default: WS_ID context (mirrors the original static mock for all existing tests).
  mockRequireOrg.mockResolvedValue(makeOrgCtx(WS_ID));
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
    expect(body.validationErrors).toBe(1);
    expect(body.serverErrors).toBe(0);
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

  it("errors include kind, row, and field fields", async () => {
    const noTitle = { ...VALID_ROW, title: undefined };
    const res = await callImport([noTitle]);
    const body = await res.json();
    const err = body.errors[0];
    expect(err.kind).toBe("validation");
    expect(err.row).toBeDefined();
  });

  it("includes skipped count equal to errors length", async () => {
    const badRow = { clientName: "X", startAt: "bad-date" };
    const res = await callImport([VALID_ROW, badRow]);
    const body = await res.json();
    expect(body.skipped).toBe(body.errors.length);
    expect(body.skipped).toBe(1);
    expect(body.validationErrors).toBe(1);
    expect(body.serverErrors).toBe(0);
  });

  it("server error during recordBookingForClient: serverErrors=1, created=0, row in errors", async () => {
    let spy: MockInstance | null = null;
    try {
      spy = vi
        .spyOn(clientTransactions, "recordBookingForClient")
        .mockRejectedValueOnce(new Error("transaction aborted"));

      const res = await callImport([VALID_ROW]);
      const body = await res.json();

      expect(body.created).toBe(0);
      expect(body.validationErrors).toBe(0);
      expect(body.serverErrors).toBe(1);
      expect(body.skipped).toBe(1);
      expect(body.errors).toHaveLength(1);
      expect(body.errors[0].kind).toBe("server");
      expect(body.errors[0].index).toBe(0);
    } finally {
      spy?.mockRestore();
    }
  });

  it("existing client gets transaction appended and summaries bumped", async () => {
    await Client.create({
      workspaceId: WS_ID,
      name: "Jane Smith",
      email: "jane@example.com",
      source: "manual",
      totalSpent: 0,
      bookingsCount: 0,
    });

    await callImport([VALID_ROW]);

    const client = await Client.findOne({ workspaceId: WS_ID, email: "jane@example.com" }).lean();
    expect(client?.bookingsCount).toBe(1);
    expect(client?.totalSpent).toBe(10_000);
    expect(client?.transactions).toHaveLength(1);

    const tx = await Transaction.findOne({ workspaceId: WS_ID }).lean();
    expect(tx?.type).toBe("deposit");
    expect(tx?.amount).toBe(10_000);
  });

  it("duplicate email in same import results in one client with N transactions", async () => {
    const row2 = {
      ...VALID_ROW,
      title: "Smith Engagement",
      amountTotal: 30000,
      amountDeposit: 0,
    };
    await callImport([VALID_ROW, row2]);

    const client = await Client.findOne({ workspaceId: WS_ID }).lean();
    expect(client?.bookingsCount).toBe(2);
    expect(client?.transactions).toHaveLength(2);

    // Only the row with deposit > 0 creates a Transaction; zero-deposit row does not.
    const txs = await Transaction.find({ workspaceId: WS_ID });
    expect(txs).toHaveLength(1);
    expect(txs[0].type).toBe("deposit");
  });

  it("invalid row increments skipped and writes no booking or transaction", async () => {
    const res = await callImport([{ title: "", clientName: "", startAt: "bad" }]);
    const body = await res.json();
    expect(body.skipped).toBe(1);
    expect(body.created).toBe(0);

    const bookings = await Booking.find({ workspaceId: WS_ID });
    expect(bookings).toHaveLength(0);

    const txs = await Transaction.find({ workspaceId: WS_ID });
    expect(txs).toHaveLength(0);
  });

  it("negative amountTotal fails validation (schema enforces non-negative)", async () => {
    const refundRow = {
      ...VALID_ROW,
      amountTotal: -5000,
      amountDeposit: 0,
    };
    const res = await callImport([refundRow]);
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].kind).toBe("validation");
    expect(body.skipped).toBe(1);
  });

  it("cross-workspace isolation: WS_B import does not contaminate WS_A client", async () => {
    // Seed workspace A with an existing Alice client.
    const aliceA = await Client.create({
      workspaceId: WS_A,
      name: "Alice",
      email: "alice@example.com",
      source: "manual",
      totalSpent: 5000,
      bookingsCount: 1,
    });

    // Switch requireOrg to return workspace B context for the import call.
    mockRequireOrg.mockResolvedValueOnce(makeOrgCtx(WS_B));

    const res = await callImport([
      {
        ...VALID_ROW,
        clientName: "Alice",
        clientEmail: "alice@example.com",
      },
    ]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(1);

    // WS_A's Alice must be unchanged.
    const clientsA = await Client.find({ workspaceId: WS_A }).lean();
    expect(clientsA).toHaveLength(1);
    expect(clientsA[0]._id.toString()).toBe(aliceA._id.toString());
    expect(clientsA[0].bookingsCount ?? 1).toBe(1);

    // WS_B gets its own new client — no cross-contamination.
    const clientsB = await Client.find({ workspaceId: WS_B }).lean();
    expect(clientsB).toHaveLength(1);
    expect(clientsB[0].email).toBe("alice@example.com");
    expect(clientsB[0].workspaceId.toString()).toBe(WS_B.toString());
  });
});

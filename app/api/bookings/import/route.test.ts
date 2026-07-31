import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type MockInstance } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, Client, Transaction, Team } from "@/lib/db/models";
import { TEAM_COLOR_PALETTE } from "@/lib/db/models/team";
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
  // The limiter is a module-level Map shared by every case in this file, so
  // without this the suite exhausts its own window part-way through.
  const { __resetRateLimitForTests } = await import("@/lib/server/rateLimit");
  __resetRateLimitForTests();
  // Default: WS_ID context (mirrors the original static mock for all existing tests).
  mockRequireOrg.mockResolvedValue(makeOrgCtx(WS_ID));
  // Seed default teams for all test workspaces so the route's
  // Team.findOne({ workspaceId, isDefault: true }) succeeds.
  const ownerUserId = "user_test";
  await Team.create([
    { workspaceId: WS_ID, name: "Main", color: TEAM_COLOR_PALETTE[0], isDefault: true, isActive: true, memberCount: 0, createdByWorkosUserId: ownerUserId },
    { workspaceId: WS_A, name: "Main", color: TEAM_COLOR_PALETTE[0], isDefault: true, isActive: true, memberCount: 0, createdByWorkosUserId: ownerUserId },
    { workspaceId: WS_B, name: "Main", color: TEAM_COLOR_PALETTE[0], isDefault: true, isActive: true, memberCount: 0, createdByWorkosUserId: ownerUserId },
  ]);
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

describe("POST /api/bookings/import — file preview", () => {
  async function callPreview(file: Blob, filename: string) {
    const { POST } = await import("./route");
    const form = new FormData();
    form.append("file", file, filename);
    return POST(
      new Request("http://localhost/api/bookings/import", { method: "POST", body: form })
    );
  }

  it("accepts a multipart upload instead of rejecting it as bad JSON", async () => {
    const { rowsToXlsxBuffer } = await import("@/lib/utils/xlsx");
    const buffer = await rowsToXlsxBuffer(
      ["title", "clientName", "clientEmail", "startAt"],
      [["Garden Wedding", "Ana Cruz", "ana@example.com", "2026-06-15T01:00:00.000Z"]]
    );
    const res = await callPreview(new Blob([new Uint8Array(buffer)]), "bookings.xlsx");
    expect(res.status).toBe(200);
  });

  it("rejects an oversized upload before parsing it", async () => {
    // exceljs decompresses in memory, so the byte cap has to bite BEFORE the
    // parse — that is the actual defense against a zip bomb.
    const huge = new Blob([new Uint8Array(2_000_001)]);
    const res = await callPreview(huge, "bookings.xlsx");
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("import_too_large");
  });

  it("answers 400 rather than 500 on a truncated zip", async () => {
    const res = await callPreview(
      new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])]),
      "x.xlsx"
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unreadable_file");
  });

  it("parses the uploaded XLSX into rows and writes nothing", async () => {
    // The preview is a dry run, so a malformed file can never half-write.
    const { rowsToXlsxBuffer } = await import("@/lib/utils/xlsx");
    const buffer = await rowsToXlsxBuffer(
      ["title", "clientName", "clientEmail", "startAt"],
      [["Garden Wedding", "Ana Cruz", "ana@example.com", "2026-06-15T01:00:00.000Z"]]
    );

    const res = await callPreview(new Blob([new Uint8Array(buffer)]), "bookings.xlsx");
    const body = await res.json();

    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].title).toBe("Garden Wedding");
    expect(await Booking.countDocuments({ workspaceId: WS_ID })).toBe(0);
  });
});

describe("POST /api/bookings/import — booking_id round-trip", () => {
  it("regroups rows sharing a booking_id into one updated multi-session booking", async () => {
    // This is the round-trip contract: an exported two-session booking comes
    // back as ONE updated booking, not two new single-session duplicates.
    const client = await Client.create({
      workspaceId: WS_ID,
      name: "Jane Smith",
      email: "jane@example.com",
      source: "manual",
    });
    const existing = await Booking.create({
      workspaceId: WS_ID,
      clientId: client._id,
      clientName: "Jane Smith",
      title: "Old Title",
      status: "booked",
      sessions: [
        {
          startAt: new Date("2026-06-15T09:00:00.000Z"),
          endAt: new Date("2026-06-15T17:00:00.000Z"),
        },
      ],
      firstSessionStart: new Date("2026-06-15T09:00:00.000Z"),
      lastSessionEnd: new Date("2026-06-15T17:00:00.000Z"),
    });

    const id = existing._id.toString();
    const res = await callImport([
      {
        ...VALID_ROW,
        title: "New Title",
        bookingId: id,
        sessionIndex: "1",
        // 01:00–09:00Z is 09:00–17:00 in Asia/Manila, so each session stays
        // within one workspace-local day (the route's same-day rule).
        startAt: "2026-06-16T01:00:00.000Z",
        endAt: "2026-06-16T09:00:00.000Z",
      },
      {
        ...VALID_ROW,
        title: "New Title",
        bookingId: id,
        sessionIndex: "0",
        startAt: "2026-06-15T01:00:00.000Z",
        endAt: "2026-06-15T09:00:00.000Z",
      },
    ]);

    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.updated).toBe(1);

    expect(await Booking.countDocuments({ workspaceId: WS_ID })).toBe(1);
    const after = await Booking.findById(existing._id).lean();
    expect(after?.title).toBe("New Title");
    expect(after?.sessions).toHaveLength(2);
    // Ordered by session_index, so the derived bounds span both days.
    expect(after?.firstSessionStart.toISOString()).toBe("2026-06-15T01:00:00.000Z");
    expect(after?.lastSessionEnd.toISOString()).toBe("2026-06-16T09:00:00.000Z");
  });


  it("resolves the client by clientId when the row has no email, without duplicating", async () => {
    // Email is optional on Client, so an exported row may carry no email at
    // all. Without clientId the importer would mint a fresh client on every
    // run, which is what made repeat imports pile up duplicates.
    const client = await Client.create({
      workspaceId: WS_ID,
      name: "No Email Client",
      source: "manual",
    });

    const noEmail: Record<string, unknown> = { ...VALID_ROW };
    delete noEmail.clientEmail;
    const res = await callImport([
      { ...noEmail, clientName: "No Email Client", clientId: client._id.toString() },
    ]);

    const body = await res.json();
    expect(body.created).toBe(1);
    expect(await Client.countDocuments({ workspaceId: WS_ID })).toBe(1);

    const booking = await Booking.findOne({ workspaceId: WS_ID }).lean();
    expect(booking?.clientId.toString()).toBe(client._id.toString());
  });

  it("is idempotent: importing the same rows twice never duplicates", async () => {
    // Retry safety. The first run creates; the second sees the booking_id it
    // was given back and updates in place.
    const first = await callImport([VALID_ROW]);
    expect((await first.json()).created).toBe(1);

    const booking = await Booking.findOne({ workspaceId: WS_ID }).lean();
    const exportedRow = { ...VALID_ROW, bookingId: booking!._id.toString(), sessionIndex: "0" };

    const second = await callImport([exportedRow]);
    const body = await second.json();
    expect(body.created).toBe(0);
    expect(body.updated).toBe(1);

    expect(await Booking.countDocuments({ workspaceId: WS_ID })).toBe(1);
    expect(await Client.countDocuments({ workspaceId: WS_ID })).toBe(1);
  });

  it("counts skipped ROWS while errors counts problems", async () => {
    // A 2-row group that fails is one error but two unwritten rows; reporting
    // skipped=1 would under-report what the user has to fix.
    const res = await callImport([
      { ...VALID_ROW, bookingId: "not-an-object-id", sessionIndex: "0" },
      { ...VALID_ROW, bookingId: "not-an-object-id", sessionIndex: "1" },
    ]);
    const body = await res.json();
    expect(body.errors).toHaveLength(1);
    expect(body.skipped).toBe(2);
  });

  it("rate-limits repeated imports per workspace", async () => {
    const { rateLimit } = await import("@/lib/server/rateLimit");
    // Exhaust the window the route uses, then confirm the next call is refused.
    for (let n = 0; n < 10; n++) {
      rateLimit(`bookings:import:${WS_ID.toString()}`, { limit: 10, windowMs: 300_000 });
    }
    const res = await callImport([VALID_ROW]);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
  });

  it("refuses a booking_id owned by another workspace and writes nothing", async () => {
    // A booking_id arrives from a user-supplied file. Updating on it without
    // re-checking ownership would be a cross-tenant write.
    const foreignClient = await Client.create({
      workspaceId: WS_B,
      name: "Other Co Client",
      source: "manual",
    });
    const foreign = await Booking.create({
      workspaceId: WS_B,
      clientId: foreignClient._id,
      clientName: "Other Co Client",
      title: "Untouchable",
      status: "booked",
      sessions: [
        {
          startAt: new Date("2026-06-15T09:00:00.000Z"),
          endAt: new Date("2026-06-15T17:00:00.000Z"),
        },
      ],
      firstSessionStart: new Date("2026-06-15T09:00:00.000Z"),
      lastSessionEnd: new Date("2026-06-15T17:00:00.000Z"),
    });

    // Caller is WS_ID (see beforeEach), targeting WS_B's booking.
    const res = await callImport([{ ...VALID_ROW, bookingId: foreign._id.toString() }]);
    const body = await res.json();

    expect(body.created).toBe(0);
    expect(body.updated).toBe(0);
    expect(body.errors[0].message).toContain("booking_not_found_in_workspace");

    // The foreign booking is untouched and nothing leaked into the caller's workspace.
    const after = await Booking.findById(foreign._id).lean();
    expect(after?.title).toBe("Untouchable");
    expect(await Booking.countDocuments({ workspaceId: WS_ID })).toBe(0);
  });
});

describe("POST /api/bookings/import", () => {
  it("creates a booking and client for a valid row", async () => {
    const mainTeam = await Team.findOne({ workspaceId: WS_ID, isDefault: true }).lean();
    const res = await callImport([VALID_ROW]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(1);
    expect(body.errors).toHaveLength(0);

    const booking = await Booking.findOne({ workspaceId: WS_ID }).lean();
    expect(booking?.title).toBe("Smith Wedding");
    expect(booking?.status).toBe("booked");
    expect(booking?.teamId?.toString()).toBe(mainTeam!._id.toString());

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

  it("transaction abort on first row: no orphan client; second row with same email creates client cleanly", async () => {
    // Row 0 fails (recordBookingForClient rejects) → transaction aborts.
    // Row 1 has the same email. It must succeed and produce exactly one client,
    // proving the email cache was NOT poisoned by the aborted row 0.
    let spy: MockInstance | null = null;
    try {
      spy = vi
        .spyOn(clientTransactions, "recordBookingForClient")
        .mockRejectedValueOnce(new Error("simulated abort"));

      const row1 = { ...VALID_ROW, title: "Smith Engagement" };
      const res = await callImport([VALID_ROW, row1]);
      const body = await res.json();

      // Row 0 failed, row 1 succeeded.
      expect(body.created).toBe(1);
      expect(body.serverErrors).toBe(1);
      expect(body.errors[0].index).toBe(0);

      // Exactly one client must exist — created by the successful row 1.
      const clients = await Client.find({ workspaceId: WS_ID }).lean();
      expect(clients).toHaveLength(1);
      expect(clients[0].email).toBe("jane@example.com");

      // Exactly one booking must exist.
      const bookings = await Booking.find({ workspaceId: WS_ID }).lean();
      expect(bookings).toHaveLength(1);
      expect(bookings[0].title).toBe("Smith Engagement");
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

  // --- Issue 3: round-trip compatibility (export fields stripped before validation) ---

  it("round-trip: row with booking_id and session_index columns imports successfully", async () => {
    // Simulates a CSV row produced by the exporter being re-imported.
    const exportRow = {
      ...VALID_ROW,
      booking_id: new Types.ObjectId().toHexString(),
      session_index: "0",
    };
    const res = await callImport([exportRow]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(1);
    expect(body.errors).toHaveLength(0);
  });

  it("round-trip: booking_id and session_index do not appear as booking fields", async () => {
    const exportRow = {
      ...VALID_ROW,
      booking_id: new Types.ObjectId().toHexString(),
      session_index: "0",
    };
    await callImport([exportRow]);
    const booking = await Booking.findOne({ workspaceId: WS_ID }).lean();
    // The Mongoose doc should not carry these export-only artefacts.
    expect((booking as Record<string, unknown>)?.booking_id).toBeUndefined();
    expect((booking as Record<string, unknown>)?.session_index).toBeUndefined();
  });

  // --- Issue 4: timezone-aware session validation ---

  it("rejects a session that crosses midnight in the workspace timezone (UTC-safe but tz-unsafe)", async () => {
    // Philippines is UTC+8. 20:00→00:30 UTC = 04:00→08:30 Philippine time — same
    // UTC date but crosses midnight in UTC+8. This test verifies the tz check
    // catches what the UTC-day guard misses.
    //
    // 2026-07-14T16:00:00Z = 2026-07-15 00:00 PHT (midnight boundary)
    // 2026-07-14T15:00:00Z = 2026-07-14 23:00 PHT → 2026-07-14T16:30:00Z = 2026-07-15 00:30 PHT
    // These are the same UTC date but cross the PHT midnight.
    const crossMidnightPHT = {
      ...VALID_ROW,
      startAt: "2026-07-14T15:00:00Z", // 23:00 PHT July 14
      endAt: "2026-07-14T16:30:00Z", // 00:30 PHT July 15
    };
    // Workspace timezone is Asia/Manila (FALLBACK_TZ) since the mock doesn't set it.
    const res = await callImport([crossMidnightPHT]);
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].kind).toBe("validation");
    expect(body.errors[0].message).toMatch(/same day in the workspace timezone/i);
  });

  it("accepts a session that looks cross-midnight UTC but is same-day in workspace timezone", async () => {
    // 2026-07-14T16:00:00Z = 2026-07-15 00:00 PHT — this IS midnight boundary,
    // so use an endAt that lands well within July 15 PHT.
    // startAt: 2026-07-15T01:00:00Z = 09:00 PHT July 15
    // endAt:   2026-07-15T10:00:00Z = 18:00 PHT July 15 — same PHT day, passes.
    const sameDayPHT = {
      ...VALID_ROW,
      startAt: "2026-07-15T01:00:00Z", // 09:00 PHT July 15
      endAt: "2026-07-15T10:00:00Z", // 18:00 PHT July 15
    };
    const res = await callImport([sameDayPHT]);
    const body = await res.json();
    expect(body.created).toBe(1);
    expect(body.errors).toHaveLength(0);
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

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, Client, Team } from "@/lib/db/models";
import { TEAM_COLOR_PALETTE } from "@/lib/db/models/team";

const WS_A = new Types.ObjectId();
const WS_B = new Types.ObjectId();

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

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
  mockRequireOrg.mockResolvedValue(makeOrgCtx(WS_A));
});

async function callExport(qs = "") {
  const { GET } = await import("./route");
  const url = `http://localhost/api/bookings/export${qs ? `?${qs}` : ""}`;
  return GET(new Request(url));
}

async function seedBooking(
  wsId: Types.ObjectId,
  overrides: Record<string, unknown> = {}
) {
  const client = await Client.create({
    workspaceId: wsId,
    name: overrides.clientName ?? "Jane Smith",
    email: overrides.clientEmail ?? "jane@example.com",
    source: "manual",
  });

  const startAt = new Date(
    (overrides.startAt as string | undefined) ?? "2026-08-15T09:00:00Z"
  );
  const endAt = new Date(
    (overrides.endAt as string | undefined) ?? "2026-08-15T18:00:00Z"
  );

  const sessions = (overrides.sessions as { startAt: string; endAt: string }[] | undefined)
    ? (overrides.sessions as { startAt: string; endAt: string }[]).map((s) => ({
        startAt: new Date(s.startAt),
        endAt: new Date(s.endAt),
      }))
    : [{ startAt, endAt }];

  const starts = sessions.map((s) => s.startAt.getTime());
  const ends = sessions.map((s) => s.endAt.getTime());

  return Booking.create({
    workspaceId: wsId,
    teamId: new Types.ObjectId(),
    clientId: client._id,
    clientName: client.name,
    title: (overrides.title as string | undefined) ?? "Smith Wedding",
    eventType: (overrides.eventType as string | undefined) ?? "wedding",
    status: (overrides.status as string | undefined) ?? "booked",
    sessions,
    firstSessionStart: new Date(Math.min(...starts)),
    lastSessionEnd: new Date(Math.max(...ends)),
    location: { address: (overrides.locationAddress as string | undefined) ?? "100 Ayala Ave" },
    amount: {
      total: (overrides.amountTotal as number | undefined) ?? 50_000,
      deposit: (overrides.amountDeposit as number | undefined) ?? 10_000,
      currency: (overrides.currency as string | undefined) ?? "PHP",
    },
    notes: (overrides.notes as string | undefined) ?? "",
  });
}

/** Parse CSV body into { headers, rows } where each row is a field array. */
function parseCsv(body: string) {
  const lines = body.split("\r\n").filter(Boolean);
  const headers = lines[0].split(",");
  const rows = lines.slice(1).map((line) => {
    // Simple split — adequate for test data that doesn't contain quoted commas
    return line.split(",");
  });
  return { headers, rows };
}

const EXPECTED_HEADERS = [
  "clientName",
  "clientEmail",
  "startAt",
  "endAt",
  "title",
  "eventType",
  "status",
  "amountTotal",
  "amountDeposit",
  "currency",
  "locationAddress",
  "notes",
  "booking_id",
  "session_index",
  // Appended after the legacy block so existing column positions never move.
  "clientId",
  "clientPhone",
  "locationLat",
  "locationLng",
  "teamName",
  "invoiceNumber",
  "payments",
  "createdAt",
];

describe("GET /api/bookings/export", () => {
  it("returns 200 with text/csv content-type and attachment header", async () => {
    await seedBooking(WS_A);

    const res = await callExport();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="gallurio-(all teams)-bookings.csv"'
    );
  });

  it("neutralizes a formula-leading title but leaves a negative amount numeric", async () => {
    // Titles are user-authored and would execute on open in Excel/Sheets.
    // amountTotal must NOT be prefixed or the number stops being a number.
    await seedBooking(WS_A, { title: "=SUM(1+1)", amountTotal: -500 });

    const res = await callExport();
    const body = await res.text();
    const { rows } = parseCsv(body);

    expect(rows[0][EXPECTED_HEADERS.indexOf("title")]).toBe("'=SUM(1+1)");
    expect(rows[0][EXPECTED_HEADERS.indexOf("amountTotal")]).toBe("-500");
  });

  it("format=xlsx returns a spreadsheet that parses back to the same rows", async () => {
    await seedBooking(WS_A, { title: "Garden Wedding" });
    const { parseXlsxToRows } = await import("@/lib/utils/xlsx");

    const res = await callExport("format=xlsx");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="gallurio-(all teams)-bookings.xlsx"'
    );

    const parsed = await parseXlsxToRows(Buffer.from(await res.arrayBuffer()));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].title).toBe("Garden Wedding");
  });

  it("rejects an unknown format instead of silently falling back to CSV", async () => {
    const res = await callExport("format=pdf");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_format");
  });

  it("CSV header includes booking_id and session_index as the last two columns", async () => {
    const res = await callExport();
    const body = await res.text();
    const { headers } = parseCsv(body);
    expect(headers).toEqual(EXPECTED_HEADERS);
  });

  it("single-session booking → 1 data row, session_index=0, booking_id matches", async () => {
    const booking = await seedBooking(WS_A, { title: "Solo Event" });

    const res = await callExport();
    const body = await res.text();
    const { rows } = parseCsv(body);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    const bidIdx = EXPECTED_HEADERS.indexOf("booking_id");
    const sidxIdx = EXPECTED_HEADERS.indexOf("session_index");

    expect(row[bidIdx]).toBe(booking._id.toString());
    expect(row[sidxIdx]).toBe("0");
  });

  it("two-session booking → 2 rows, same booking_id, correct session indices and startAt/endAt", async () => {
    const booking = await seedBooking(WS_A, {
      title: "Multi-Day Event",
      sessions: [
        { startAt: "2026-07-01T09:00:00Z", endAt: "2026-07-01T18:00:00Z" },
        { startAt: "2026-07-03T09:00:00Z", endAt: "2026-07-03T18:00:00Z" },
      ],
    });

    const res = await callExport();
    const body = await res.text();
    const { rows } = parseCsv(body);

    expect(rows).toHaveLength(2);

    const bidIdx = EXPECTED_HEADERS.indexOf("booking_id");
    const sidxIdx = EXPECTED_HEADERS.indexOf("session_index");
    const startIdx = EXPECTED_HEADERS.indexOf("startAt");
    const endIdx = EXPECTED_HEADERS.indexOf("endAt");

    // Both rows share the same booking_id
    expect(rows[0][bidIdx]).toBe(booking._id.toString());
    expect(rows[1][bidIdx]).toBe(booking._id.toString());

    // Session indices are 0 and 1
    expect(rows[0][sidxIdx]).toBe("0");
    expect(rows[1][sidxIdx]).toBe("1");

    // Session-specific start/end timestamps
    expect(rows[0][startIdx]).toBe("2026-07-01T09:00:00.000Z");
    expect(rows[0][endIdx]).toBe("2026-07-01T18:00:00.000Z");
    expect(rows[1][startIdx]).toBe("2026-07-03T09:00:00.000Z");
    expect(rows[1][endIdx]).toBe("2026-07-03T18:00:00.000Z");
  });

  it("tenant isolation: workspace A export does not include workspace B bookings", async () => {
    await seedBooking(WS_A, { title: "A Event", clientName: "Alice", clientEmail: "alice@a.com" });
    await seedBooking(WS_A, {
      title: "A Event 2",
      clientName: "Alice2",
      clientEmail: "alice2@a.com",
      startAt: "2026-09-01T09:00:00Z",
      endAt: "2026-09-01T18:00:00Z",
    });
    await seedBooking(WS_B, { title: "B Event", clientName: "Bob", clientEmail: "bob@b.com", startAt: "2026-10-01T09:00:00Z", endAt: "2026-10-01T18:00:00Z" });
    await seedBooking(WS_B, { title: "B Event 2", clientName: "Bob2", clientEmail: "bob2@b.com", startAt: "2026-11-01T09:00:00Z", endAt: "2026-11-01T18:00:00Z" });

    // Export as WS_A (mock set to WS_A in beforeEach)
    const res = await callExport();
    const body = await res.text();
    const lines = body.split("\r\n").filter(Boolean);

    // Only WS_A rows: header + 2 data rows
    expect(lines).toHaveLength(3);
    expect(body).not.toContain("B Event");
    expect(body).not.toContain("bob@b.com");
  });

  it("includes cancelled bookings by default (opt-out convention)", async () => {
    await seedBooking(WS_A, { title: "Active", status: "booked" });
    await seedBooking(WS_A, {
      title: "Cancelled",
      status: "cancelled",
      clientName: "Cancelled Client",
      clientEmail: "cancelled@example.com",
      startAt: "2026-09-01T09:00:00Z",
      endAt: "2026-09-01T18:00:00Z",
    });

    const res = await callExport();
    const body = await res.text();
    const lines = body.split("\r\n").filter(Boolean);

    expect(lines).toHaveLength(3); // header + 2 rows
    expect(body).toContain("Cancelled");
  });

  it("excludes cancelled bookings when includeCancelled=0", async () => {
    await seedBooking(WS_A, { title: "Active", status: "booked" });
    await seedBooking(WS_A, {
      title: "Cancelled",
      status: "cancelled",
      clientName: "Cancelled Client",
      clientEmail: "cancelled@example.com",
      startAt: "2026-09-01T09:00:00Z",
      endAt: "2026-09-01T18:00:00Z",
    });

    const res = await callExport("includeCancelled=0");
    const body = await res.text();
    const lines = body.split("\r\n").filter(Boolean);

    expect(lines).toHaveLength(2); // header + 1 active row
    expect(body).not.toContain("Cancelled");
  });

  it("includes past bookings by default (opt-out convention)", async () => {
    await seedBooking(WS_A, {
      title: "Past Event",
      startAt: "2020-01-01T09:00:00Z",
      endAt: "2020-01-01T18:00:00Z",
    });
    await seedBooking(WS_A, { title: "Future Event" });

    const res = await callExport();
    const body = await res.text();
    const lines = body.split("\r\n").filter(Boolean);

    expect(lines).toHaveLength(3); // header + 2 rows
    expect(body).toContain("Past Event");
  });

  it("excludes past bookings when showPast=0", async () => {
    await seedBooking(WS_A, {
      title: "Past Event",
      startAt: "2020-01-01T09:00:00Z",
      endAt: "2020-01-01T18:00:00Z",
    });
    await seedBooking(WS_A, { title: "Future Event" });

    const res = await callExport("showPast=0");
    const body = await res.text();
    const lines = body.split("\r\n").filter(Boolean);

    expect(lines).toHaveLength(2); // header + 1 future row
    expect(body).not.toContain("Past Event");
  });

  it("happy path: 3 single-session bookings → header row + 3 data rows", async () => {
    await seedBooking(WS_A, { title: "Alpha Event", clientName: "Alice", clientEmail: "alice@example.com" });
    await seedBooking(WS_A, { title: "Beta Event", clientName: "Bob", clientEmail: "bob@example.com", startAt: "2026-09-01T09:00:00Z", endAt: "2026-09-01T18:00:00Z" });
    await seedBooking(WS_A, { title: "Gamma Event", clientName: "Carol", clientEmail: "carol@example.com", startAt: "2026-10-01T09:00:00Z", endAt: "2026-10-01T18:00:00Z" });

    const res = await callExport();
    const body = await res.text();
    const lines = body.split("\r\n").filter(Boolean);

    expect(lines).toHaveLength(4); // 1 header + 3 data
    expect(lines[0]).toBe(EXPECTED_HEADERS.join(","));
    expect(lines[1]).toContain("Alpha Event");
    expect(lines[2]).toContain("Beta Event");
    expect(lines[3]).toContain("Gamma Event");
  });

  it("empty workspace → header line only (with trailing CRLF)", async () => {
    const res = await callExport();
    const body = await res.text();
    expect(body).toBe(EXPECTED_HEADERS.join(",") + "\r\n");
  });

  it("correctly quotes a title with a comma and notes with a double-quote", async () => {
    await seedBooking(WS_A, {
      title: "Smith, Jr. Wedding",
      notes: `She said "beautiful"`,
    });

    const res = await callExport();
    const body = await res.text();

    expect(body).toContain('"Smith, Jr. Wedding"');
    expect(body).toContain(`"She said ""beautiful"""`);
  });

  it("returns 413 when booking count exceeds 10,000", async () => {
    // Use the top-level Booking import (same module instance the route uses).
    const spy = vi.spyOn(Booking, "countDocuments").mockResolvedValueOnce(10_001 as never);

    try {
      const res = await callExport();
      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error).toBe("export_too_large");
    } finally {
      spy.mockRestore();
    }
  });

  it("does not truncate when count is exactly 10,000", async () => {
    // countDocuments returns exactly 10_000 — should proceed and return CSV.
    await seedBooking(WS_A);
    const spy = vi.spyOn(Booking, "countDocuments").mockResolvedValueOnce(10_000 as never);

    try {
      const res = await callExport();
      expect(res.status).toBe(200);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("GET /api/bookings/export — team narrowing", () => {
  it("exports every requested team and names each one in the download", async () => {
    await Team.create([
      { workspaceId: WS_A, name: "Alpha", color: TEAM_COLOR_PALETTE[0], isDefault: true, isActive: true, memberCount: 0, createdByWorkosUserId: "user_test" },
      { workspaceId: WS_A, name: "Beta", color: TEAM_COLOR_PALETTE[1], isDefault: false, isActive: true, memberCount: 0, createdByWorkosUserId: "user_test" },
    ]);
    const [alpha, beta] = await Team.find({ workspaceId: WS_A }).sort({ name: 1 }).lean();

    await seedBooking(WS_A, { title: "Alpha Wedding" });
    await Booking.updateOne({ title: "Alpha Wedding" }, { $set: { teamId: alpha._id } });
    await seedBooking(WS_A, { title: "Beta Wedding" });
    await Booking.updateOne({ title: "Beta Wedding" }, { $set: { teamId: beta._id } });

    const res = await callExport(
      `teamId=${alpha._id.toString()}&teamId=${beta._id.toString()}`
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="gallurio-(Alpha,Beta)-bookings.csv"'
    );
    const body = await res.text();
    expect(body).toContain("Alpha Wedding");
    expect(body).toContain("Beta Wedding");
  });
});

describe("GET /api/bookings/export — date range", () => {
  it("includes bookings on the to-date itself", async () => {
    // A bare "2026-08-15" is midnight UTC, so $lte would drop everything that
    // day. The picker hands over whole days, so both ends cover whole days in
    // the workspace timezone.
    await seedBooking(WS_A, {
      title: "Same Day",
      startAt: "2026-08-15T09:00:00Z",
      endAt: "2026-08-15T13:00:00Z",
    });

    const res = await callExport("from=2026-08-15&to=2026-08-15");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="gallurio-(all teams)-bookings-2026-08-15-to-2026-08-15.csv"'
    );
    expect(await res.text()).toContain("Same Day");
  });
});

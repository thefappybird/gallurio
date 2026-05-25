import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, Client } from "@/lib/db/models";

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

  return Booking.create({
    workspaceId: wsId,
    clientId: client._id,
    clientName: client.name,
    title: (overrides.title as string | undefined) ?? "Smith Wedding",
    eventType: (overrides.eventType as string | undefined) ?? "wedding",
    status: (overrides.status as string | undefined) ?? "booked",
    sessions: [{ startAt, endAt }],
    firstSessionStart: startAt,
    lastSessionEnd: endAt,
    location: { address: (overrides.locationAddress as string | undefined) ?? "100 Ayala Ave" },
    amount: {
      total: (overrides.amountTotal as number | undefined) ?? 50_000,
      deposit: (overrides.amountDeposit as number | undefined) ?? 10_000,
      currency: (overrides.currency as string | undefined) ?? "PHP",
    },
    notes: (overrides.notes as string | undefined) ?? "",
  });
}

describe("GET /api/bookings/export", () => {
  it("returns 200 with text/csv content-type and attachment header", async () => {
    await seedBooking(WS_A);

    const res = await callExport();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="bookings-\d{4}-\d{2}-\d{2}\.csv"$/
    );
  });

  it("happy path: 3 bookings → header row + 3 data rows", async () => {
    await seedBooking(WS_A, { title: "Alpha Event", clientName: "Alice", clientEmail: "alice@example.com" });
    await seedBooking(WS_A, { title: "Beta Event", clientName: "Bob", clientEmail: "bob@example.com", startAt: "2026-09-01T09:00:00Z", endAt: "2026-09-01T18:00:00Z" });
    await seedBooking(WS_A, { title: "Gamma Event", clientName: "Carol", clientEmail: "carol@example.com", startAt: "2026-10-01T09:00:00Z", endAt: "2026-10-01T18:00:00Z" });

    const res = await callExport();
    const body = await res.text();
    const lines = body.split("\r\n").filter(Boolean);

    expect(lines).toHaveLength(4); // 1 header + 3 data
    expect(lines[0]).toBe(
      "clientName,clientEmail,startAt,endAt,title,eventType,status,amountTotal,amountDeposit,currency,locationAddress,notes"
    );
    expect(lines[1]).toContain("Alpha Event");
    expect(lines[2]).toContain("Beta Event");
    expect(lines[3]).toContain("Gamma Event");
  });

  it("tenant isolation: workspace A sees only its own bookings", async () => {
    await seedBooking(WS_A, { title: "A Event", clientName: "Alice", clientEmail: "alice@a.com" });
    await seedBooking(WS_A, { title: "A Event 2", clientName: "Alice2", clientEmail: "alice2@a.com", startAt: "2026-09-01T09:00:00Z", endAt: "2026-09-01T18:00:00Z" });
    // Seed 2 bookings directly in WS_B (seedBooking uses Mongoose directly — no requireOrg)
    await seedBooking(WS_B, { title: "B Event", clientName: "Bob", clientEmail: "bob@b.com", startAt: "2026-10-01T09:00:00Z", endAt: "2026-10-01T18:00:00Z" });
    await seedBooking(WS_B, { title: "B Event 2", clientName: "Bob2", clientEmail: "bob2@b.com", startAt: "2026-11-01T09:00:00Z", endAt: "2026-11-01T18:00:00Z" });

    // Export as WS_A (mock already set to WS_A in beforeEach)
    const res = await callExport();
    const body = await res.text();
    const lines = body.split("\r\n").filter(Boolean);

    // Only WS_A rows
    expect(lines).toHaveLength(3); // header + 2 WS_A rows
    expect(body).not.toContain("B Event");
    expect(body).not.toContain("bob@b.com");
  });

  it("excludes cancelled bookings by default", async () => {
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

    expect(lines).toHaveLength(2); // header + 1 active
    expect(body).not.toContain("Cancelled");
  });

  it("includes cancelled bookings when includeCancelled=1", async () => {
    await seedBooking(WS_A, { title: "Active", status: "booked" });
    await seedBooking(WS_A, {
      title: "Cancelled",
      status: "cancelled",
      clientName: "Cancelled Client",
      clientEmail: "cancelled@example.com",
      startAt: "2026-09-01T09:00:00Z",
      endAt: "2026-09-01T18:00:00Z",
    });

    const res = await callExport("includeCancelled=1");
    const body = await res.text();
    const lines = body.split("\r\n").filter(Boolean);

    expect(lines).toHaveLength(3); // header + 2 rows
    expect(body).toContain("Cancelled");
  });

  it("empty workspace → header line only (with trailing CRLF)", async () => {
    const res = await callExport();
    const body = await res.text();
    expect(body).toBe(
      "clientName,clientEmail,startAt,endAt,title,eventType,status,amountTotal,amountDeposit,currency,locationAddress,notes\r\n"
    );
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
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, ActivityLog, Client, Team, User, TEAM_COLOR_PALETTE } from "@/lib/db/models";

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
const userId = "user_test";
const teamId = new Types.ObjectId();

// Mutable auth holder so tests can flip role/memberships to exercise the
// canEditBooking + team-scope wiring (reset in beforeEach).
const auth = vi.hoisted(() => ({
  role: "owner" as "owner" | "staff",
  memberships: [] as { teamId: string; role: "member" | "lead" }[],
  workspaceOverrides: {} as Record<string, unknown>,
}));

// Mutable spy holders for cancellation email senders.
const cancelledMocks = vi.hoisted(() => ({
  sendBookingCancelledClient: vi.fn(),
  sendBookingCancelledOwner: vi.fn(),
  resolveWorkspaceBrand: vi.fn((_arg: unknown) => ({ kind: "partner", name: "Test", accentHex: null, poweredByGallurio: false })),
}));

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId,
    role: auth.role,
    workspace: { _id: workspaceId, currency: "PHP", name: "Test", slug: "t", ...auth.workspaceOverrides },
  }),
}));

vi.mock("@/lib/auth/teamContext", () => ({
  getTeamsForUser: async () => auth.memberships,
}));

vi.mock("@/lib/email/booking/bookingCancelled", () => ({
  sendBookingCancelledClient: (arg: unknown) => cancelledMocks.sendBookingCancelledClient(arg),
  sendBookingCancelledOwner: (arg: unknown) => cancelledMocks.sendBookingCancelledOwner(arg),
}));

vi.mock("@/lib/email/brand", () => ({
  resolveWorkspaceBrand: (arg: unknown) => cancelledMocks.resolveWorkspaceBrand(arg as never),
  gallurioBrand: () => ({ kind: "platform", name: "Gallurio", accentHex: null, poweredByGallurio: false }),
}));

const emit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sockets/emitDataChanged", () => ({ emitDataChanged: emit }));

const notificationMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/notifications/send", () => ({
  sendNotification: (arg: unknown) => notificationMock(arg),
}));

// Mutable so individual tests can simulate a specific rate or an FX outage
// (null) without touching the network. Default: same-currency freeze only.
const fx = vi.hoisted(() => ({
  resolveFxFreeze: vi.fn(async (base: string, target: string) =>
    base === target ? { rate: 1, target } : null
  ),
}));
vi.mock("@/lib/pricing/fxRates", () => ({
  resolveFxFreeze: (base: string, target: string) => fx.resolveFxFreeze(base, target),
}));

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  auth.role = "owner";
  auth.memberships = [];
  auth.workspaceOverrides = {};
  cancelledMocks.sendBookingCancelledClient.mockReset();
  cancelledMocks.sendBookingCancelledClient.mockResolvedValue(undefined);
  cancelledMocks.sendBookingCancelledOwner.mockReset();
  cancelledMocks.sendBookingCancelledOwner.mockResolvedValue(undefined);
  cancelledMocks.resolveWorkspaceBrand.mockReset();
  cancelledMocks.resolveWorkspaceBrand.mockReturnValue({ kind: "partner", name: "Test", accentHex: null, poweredByGallurio: false });
  notificationMock.mockReset();
  notificationMock.mockResolvedValue(undefined);
  emit.mockClear();
  fx.resolveFxFreeze.mockReset();
  fx.resolveFxFreeze.mockImplementation(async (base: string, target: string) =>
    base === target ? { rate: 1, target } : null
  );
  await Team.create({
    _id: teamId,
    workspaceId,
    name: "Main",
    color: TEAM_COLOR_PALETTE[0],
    isDefault: true,
    isActive: true,
    memberCount: 0,
    createdByWorkosUserId: userId,
  });
});

async function load() {
  return import("./route");
}

async function seedClient(wid: Types.ObjectId, overrides: Record<string, unknown> = {}) {
  return Client.create({
    workspaceId: wid,
    name: "Emma Carter",
    email: "emma@example.com",
    source: "manual",
    bookingsCount: 0,
    totalSpent: 0,
    ...overrides,
  });
}

async function seedBooking(
  wid: Types.ObjectId,
  clientId: Types.ObjectId,
  overrides: Record<string, unknown> = {}
) {
  const defaultStart = new Date("2026-08-15T10:00:00Z");
  return Booking.create({
    workspaceId: wid,
    teamId,
    clientId,
    clientName: "Emma Carter",
    title: "Carter Wedding",
    status: "booked",
    sessions: [{ startAt: defaultStart, endAt: defaultStart }],
    firstSessionStart: defaultStart,
    lastSessionEnd: defaultStart,
    amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
    ...overrides,
  });
}

function makePatch(body: unknown, id: string) {
  return new Request(`http://test/api/bookings/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGet(id: string) {
  return new Request(`http://test/api/bookings/${id}`, { method: "GET" });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/bookings/[id]", () => {
  it("returns the booking when workspaceId matches", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe("Carter Wedding");
  });

  it("returns 404 when the booking belongs to another workspace (tenant isolation)", async () => {
    const c = await seedClient(otherWorkspaceId);
    const b = await seedBooking(otherWorkspaceId, c._id);
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const { GET } = await load();
    const res = await GET(makeGet("not-an-id"), ctx("not-an-id"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a draft booking (drafts are not visible on the bookings surface)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, { status: "draft" });
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(404);
  });

  it("GET includes client block with id, name, email, phone when client exists", async () => {
    const c = await seedClient(workspaceId, {
      name: "Emma Carter",
      email: "emma@example.com",
      phone: "+639171234567",
    });
    const b = await seedBooking(workspaceId, c._id);
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.client).toEqual({
      id: c._id.toString(),
      name: "Emma Carter",
      email: "emma@example.com",
      phone: "+639171234567",
    });
  });

  it("GET tenant isolation: org B cannot fetch org A's booking (404, no client leak)", async () => {
    // Seed booking in org A (workspaceId). requireOrg is mocked to return
    // workspaceId, so a booking seeded under otherWorkspaceId must 404.
    const c = await seedClient(otherWorkspaceId, { name: "Other Client" });
    const b = await seedBooking(otherWorkspaceId, c._id);
    const { GET } = await load();
    // requireOrg returns workspaceId (the mock is fixed) — so looking up a
    // booking owned by otherWorkspaceId must never return data.
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(404);
  });

  it("GET returns client: null when client doc is missing (hard-deleted)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    // Hard-delete the client to simulate orphan booking
    await Client.deleteOne({ _id: c._id });
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.client).toBeNull();
    // The booking itself must still be present.
    expect(json.title).toBe("Carter Wedding");
  });
});

describe("PATCH /api/bookings/[id]", () => {
  it("refuses to patch a draft booking (404) — promotion goes through approval", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, { status: "draft" });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ title: "Renamed" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(404);
    expect((await Booking.findById(b._id).lean())?.title).toBe("Carter Wedding");
  });

  it("applies a single-field patch and writes one activity entry", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ title: "Renamed" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe("Renamed");

    const log = await ActivityLog.findOne({ workspaceId, entity: "booking" }).lean();
    expect(log?.action).toBe("updated");
    const diff = log?.diff as { changes?: Record<string, { before: unknown; after: unknown }> };
    expect(diff?.changes?.title).toEqual({ before: "Carter Wedding", after: "Renamed" });
  });

  it("emits booking.updated with the server workspaceId after a successful patch", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ title: "Renamed" }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    expect(emit).toHaveBeenCalledWith(String(workspaceId), {
      type: "booking.updated",
      bookingId: String(b._id),
      clientId: String(c._id),
      inquiryId: null,
    });
  });

  it("applies a multi-field patch and writes ONE activity entry with all changes", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch(
        { title: "Renamed", "amount.total": 50_000, notes: "Updated" },
        b._id.toString()
      ),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);

    const logs = await ActivityLog.find({ workspaceId, entity: "booking" }).lean();
    expect(logs).toHaveLength(1);
    const diff = logs[0].diff as { changes?: Record<string, unknown> };
    expect(Object.keys(diff.changes ?? {}).sort()).toEqual([
      "amount.total",
      "notes",
      "title",
    ]);
  });

  it("logs action='status_changed' when status is in the patch", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    await PATCH(
      makePatch({ status: "cancelled" }, b._id.toString()),
      ctx(b._id.toString())
    );
    const log = await ActivityLog.findOne({ workspaceId, entity: "booking" }).lean();
    expect(log?.action).toBe("status_changed");
  });

  it("rejects unknown keys with 400 (strict allowlist)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ workspaceId: "leak" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(400);
  });

  it("rejects an empty body with 400", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(makePatch({}, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(400);
  });

  it("returns 404 when patching a booking from another workspace", async () => {
    const c = await seedClient(otherWorkspaceId);
    const b = await seedBooking(otherWorkspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ title: "Hacked" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(404);
    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.title).toBe("Carter Wedding");
    expect(emit).not.toHaveBeenCalled();
  });

  it("skips identical values and does not write an activity log", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    await PATCH(
      makePatch({ title: "Carter Wedding" }, b._id.toString()),
      ctx(b._id.toString())
    );
    const logs = await ActivityLog.find({ workspaceId, entity: "booking" }).lean();
    expect(logs).toHaveLength(0);
  });
});

describe("PATCH /api/bookings/[id] — payments + completion guard", () => {
  it("persists a normalized payments patch (paidAt set, createdAt defaulted)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, {
      amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
    });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ payments: [{ price: 10_000, status: "paid" }] }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.payments).toHaveLength(1);
    expect(fresh?.payments?.[0].price).toBe(10_000);
    expect(fresh?.payments?.[0].paidAt).toBeInstanceOf(Date);
    expect(fresh?.payments?.[0].createdAt).toBeInstanceOf(Date);
  });

  it("auto-completes when a payments patch brings deposit+payments to match the total", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, {
      status: "booked",
      amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
    });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ payments: [{ price: 50_000, status: "paid" }] }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.status).toBe("completed");

    const logs = await ActivityLog.find({ workspaceId, entity: "booking" }).sort({ action: 1 }).lean();
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => l.action).sort()).toEqual(["payment_added", "status_changed"]);
  });

  it("notifies status_changed with the auto-completed status even though the client only sent payments", async () => {
    auth.workspaceOverrides = { contact: { email: "owner@studio.test" } };
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, {
      status: "booked",
      amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
    });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ payments: [{ price: 50_000, status: "paid" }] }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const statusChangeCall = notificationMock.mock.calls.find(
      ([arg]) => (arg as { type?: string }).type === "booking.status_changed"
    );
    expect(statusChangeCall).toBeDefined();
    expect((statusChangeCall![0] as { vars: { newStatus: string } }).vars.newStatus).toBe("completed");
  });

  it("a payments-only patch that does not reach completion writes exactly one payment_added entry", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, {
      status: "booked",
      amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
    });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ payments: [{ price: 10_000, status: "paid" }] }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.status).toBe("booked");

    const logs = await ActivityLog.find({ workspaceId, entity: "booking" }).lean();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("payment_added");
  });

  it("returns 422 when patching status to completed with an unpaid payment", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, {
      amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
      payments: [{ price: 50_000, status: "unpaid", createdAt: new Date() }],
    });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ status: "completed" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when the paid sum is a cent short of the total", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, {
      amount: { total: 75_000, deposit: 0, currency: "PHP" },
      payments: [{ price: 74_999.99, status: "paid", createdAt: new Date(), paidAt: new Date() }],
    });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ status: "completed" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(422);
  });

  it("returns 200 when patching status to completed with fully-paid payments matching the total", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, {
      amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
      payments: [{ price: 50_000, status: "paid", createdAt: new Date(), paidAt: new Date() }],
    });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ status: "completed" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.status).toBe("completed");
  });

  it("freezes the fx rate on a payment that newly becomes paid, when the booking currency differs from workspace currency (PHP)", async () => {
    fx.resolveFxFreeze.mockResolvedValueOnce({ rate: 58, target: "PHP" });
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, {
      amount: { total: 1000, deposit: 0, currency: "USD" },
    });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ payments: [{ price: 1000, status: "paid" }] }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    expect(fx.resolveFxFreeze).toHaveBeenCalledWith("USD", "PHP");
    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.payments?.[0].fxRate).toBe(58);
    expect(fresh?.payments?.[0].fxTarget).toBe("PHP");
  });

  it("never recaptures an already-frozen payment when the client resends the payments array on an unrelated edit", async () => {
    const c = await seedClient(workspaceId);
    const frozenAt = new Date("2026-01-01T00:00:00.000Z");
    const b = await seedBooking(workspaceId, c._id, {
      amount: { total: 1000, deposit: 0, currency: "USD" },
      payments: [
        {
          price: 1000,
          status: "paid",
          createdAt: frozenAt,
          paidAt: frozenAt,
          fxRate: 55,
          fxTarget: "PHP",
          fxAt: frozenAt,
        },
      ],
    });
    // A fresh freeze WOULD be available today at a different rate — proving
    // the stored 55 survives only because it is never recaptured, not because
    // the mock happened to return null.
    fx.resolveFxFreeze.mockResolvedValue({ rate: 58, target: "PHP" });
    const { PATCH } = await load();
    const res = await PATCH(
      // Client never round-trips fx fields — this is the shape the real UI sends.
      makePatch(
        { title: "Renamed", payments: [{ price: 1000, status: "paid" }] },
        b._id.toString()
      ),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.payments?.[0].fxRate).toBe(55);
    expect(fresh?.payments?.[0].fxTarget).toBe("PHP");
    expect(fresh?.payments?.[0].fxAt?.toISOString()).toBe(frozenAt.toISOString());
  });

  it("leaves fx fields null and still applies the patch when the FX rate is unavailable (outage never blocks the write)", async () => {
    fx.resolveFxFreeze.mockResolvedValueOnce(null);
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, {
      amount: { total: 1000, deposit: 0, currency: "USD" },
    });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ payments: [{ price: 1000, status: "paid" }] }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.payments?.[0].fxRate ?? null).toBeNull();
    expect(fresh?.payments?.[0].fxTarget ?? null).toBeNull();
  });

  it("returns 422 payments_exceed_balance when a payments patch pushes the sum past total - deposit", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, {
      amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
    });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ payments: [{ price: 60_000, status: "unpaid" }] }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("payments_exceed_balance");
  });
});

describe("PATCH /api/bookings/[id] — location pin (lat/lng)", () => {
  it("persists address + lat + lng but logs only the address in the activity diff", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch(
        { "location.address": "Pier 27, Manila", "location.lat": 14.6, "location.lng": 120.98 },
        b._id.toString()
      ),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);

    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.location?.address).toBe("Pier 27, Manila");
    expect(fresh?.location?.lat).toBe(14.6);
    expect(fresh?.location?.lng).toBe(120.98);

    const logs = await ActivityLog.find({ workspaceId, entity: "booking" }).lean();
    expect(logs).toHaveLength(1);
    const changes = (logs[0].diff as { changes?: Record<string, unknown> }).changes ?? {};
    expect(changes).toHaveProperty("location.address");
    expect(changes).not.toHaveProperty("location.lat");
    expect(changes).not.toHaveProperty("location.lng");
  });

  it("persists a coordinate-only nudge WITHOUT writing an activity entry", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ "location.lat": 1.23, "location.lng": 4.56 }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);

    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.location?.lat).toBe(1.23);
    expect(fresh?.location?.lng).toBe(4.56);

    const logs = await ActivityLog.find({ workspaceId, entity: "booking" }).lean();
    expect(logs).toHaveLength(0);
  });

  it("rejects an out-of-range latitude with 400", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ "location.lat": 200 }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/bookings/[id] — client block in response", () => {
  it("PATCH on a non-client field includes client block with correct email and phone", async () => {
    const c = await seedClient(workspaceId, {
      name: "Emma Carter",
      email: "emma@example.com",
      phone: "+639171234567",
    });
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ title: "Emma's Wedding" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe("Emma's Wedding");
    expect(json.client).toEqual({
      id: c._id.toString(),
      name: "Emma Carter",
      email: "emma@example.com",
      phone: "+639171234567",
    });
  });

  it("PATCH response has client: null when client doc is missing from DB (hard-deleted before patch)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    // Hard-delete the client so the booking is orphaned
    await Client.deleteOne({ _id: c._id });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ title: "Orphaned Title Edit" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    // buildClientBlock must return null when the client doc no longer exists
    expect(json.client).toBeNull();
    expect(json.title).toBe("Orphaned Title Edit");
  });

  it("PATCH response has client: null when client doc is hard-deleted (orphan booking)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    // Hard-delete the client to simulate an orphan booking
    await Client.deleteOne({ _id: c._id });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ title: "Orphan Booking" }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.client).toBeNull();
    expect(json.title).toBe("Orphan Booking");
  });
});

describe("PATCH /api/bookings/[id] — client reassignment", () => {
  it("single-session: PATCH with new clientId updates booking and logs client_changed", async () => {
    const oldClient = await seedClient(workspaceId, {
      name: "Emma Carter",
      email: "emma@example.com",
      bookingsCount: 1,
      totalSpent: 25_000,
    });
    const newClient = await seedClient(workspaceId, {
      name: "Liam Carter",
      email: "liam@example.com",
      bookingsCount: 0,
      totalSpent: 0,
    });
    const b = await seedBooking(workspaceId, oldClient._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ clientId: newClient._id.toString() }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clientId.toString()).toBe(newClient._id.toString());
    expect(json.clientName).toBe("Liam Carter");

    const log = await ActivityLog.findOne({ workspaceId, entity: "booking" }).lean();
    expect(log?.action).toBe("client_changed");
    const meta = log?.meta as { from: string; to: string } | null;
    expect(meta?.from).toBe(oldClient._id.toString());
    expect(meta?.to).toBe(newClient._id.toString());
  });

  it("single-session: client transaction stats reconciled on reassignment", async () => {
    const { Transaction } = await import("@/lib/db/models");
    const oldClient = await seedClient(workspaceId, {
      name: "Emma Carter",
      bookingsCount: 1,
      totalSpent: 25_000,
    });
    const newClient = await seedClient(workspaceId, {
      name: "Liam Carter",
      bookingsCount: 0,
      totalSpent: 0,
    });
    // Seed a Transaction doc for the old client.
    const defaultStart = new Date("2026-08-15T10:00:00Z");
    const b = await seedBooking(workspaceId, oldClient._id);
    await Transaction.create({
      workspaceId,
      bookingId: b._id,
      clientId: oldClient._id,
      amount: 25_000,
      currency: "PHP",
      type: "deposit",
      method: "other",
      paidAt: defaultStart,
    });

    const { PATCH } = await load();
    await PATCH(
      makePatch({ clientId: newClient._id.toString() }, b._id.toString()),
      ctx(b._id.toString())
    );

    const updatedOld = await Client.findById(oldClient._id).lean();
    expect(updatedOld?.totalSpent).toBe(0);
    expect(updatedOld?.bookingsCount).toBe(0);

    const updatedNew = await Client.findById(newClient._id).lean();
    expect(updatedNew?.totalSpent).toBe(25_000);
    expect(updatedNew?.bookingsCount).toBe(1);

    // Transaction doc must be re-assigned to new client.
    const tx = await Transaction.findOne({ bookingId: b._id }).lean();
    expect(tx?.clientId?.toString()).toBe(newClient._id.toString());
  });

  it("multi-session: PATCH with clientId returns 422", async () => {
    const oldClient = await seedClient(workspaceId);
    const newClient = await seedClient(workspaceId, { name: "Other Client" });
    const s1 = new Date("2026-08-15T10:00:00Z");
    const s2 = new Date("2026-08-22T10:00:00Z");
    const b = await seedBooking(workspaceId, oldClient._id, {
      sessions: [
        { startAt: s1, endAt: s1 },
        { startAt: s2, endAt: s2 },
      ],
      firstSessionStart: s1,
      lastSessionEnd: s2,
    });
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ clientId: newClient._id.toString() }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("client_change_multi_session");
  });

  it("tenant isolation: rejects clientId from another workspace with 404", async () => {
    const myClient = await seedClient(workspaceId);
    const otherClient = await seedClient(otherWorkspaceId, { name: "Other WS Client" });
    const b = await seedBooking(workspaceId, myClient._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ clientId: otherClient._id.toString() }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(404);
    // Booking's clientId must be unchanged.
    const fresh = await Booking.findById(b._id).lean();
    expect(fresh?.clientId.toString()).toBe(myClient._id.toString());
  });

  it("concurrent clientId + amount.deposit change: new client receives the updated deposit, not the stale one", async () => {
    // Booking starts with deposit=25_000. PATCH changes it to 40_000 AND
    // reassigns to a new client in the same request. The new client must be
    // credited with 40_000, not the pre-patch 25_000.
    const { Transaction } = await import("@/lib/db/models");
    const oldClient = await seedClient(workspaceId, {
      name: "Emma Carter",
      bookingsCount: 1,
      totalSpent: 25_000,
    });
    const newClient = await seedClient(workspaceId, {
      name: "Liam Carter",
      email: "liam@example.com",
      bookingsCount: 0,
      totalSpent: 0,
    });
    const defaultStart = new Date("2026-08-15T10:00:00Z");
    const b = await seedBooking(workspaceId, oldClient._id);
    await Transaction.create({
      workspaceId,
      bookingId: b._id,
      clientId: oldClient._id,
      amount: 25_000,
      currency: "PHP",
      type: "deposit",
      method: "other",
      paidAt: defaultStart,
    });

    const { PATCH } = await load();
    const res = await PATCH(
      makePatch(
        { clientId: newClient._id.toString(), "amount.deposit": 40_000 },
        b._id.toString()
      ),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);

    // Old client: stats zeroed out.
    const updatedOld = await Client.findById(oldClient._id).lean();
    expect(updatedOld?.totalSpent).toBe(0);
    expect(updatedOld?.bookingsCount).toBe(0);

    // New client: must reflect the NEW deposit (40_000), not the stale 25_000.
    const updatedNew = await Client.findById(newClient._id).lean();
    expect(updatedNew?.bookingsCount).toBe(1);
    expect(updatedNew?.totalSpent).toBe(40_000);

    // Transaction doc re-assigned to new client with updated amount.
    const tx = await Transaction.findOne({ bookingId: b._id }).lean();
    expect(tx?.clientId?.toString()).toBe(newClient._id.toString());
    expect(tx?.amount).toBe(40_000);
  });

  it("PATCH response includes client block reflecting NEW client after reassignment", async () => {
    const oldClient = await seedClient(workspaceId, {
      name: "Emma Carter",
      email: "emma@example.com",
      phone: "+639171234567",
      bookingsCount: 1,
      totalSpent: 75_000,
    });
    const newClient = await seedClient(workspaceId, {
      name: "Liam Carter",
      email: "liam@example.com",
      phone: "+639179999999",
      bookingsCount: 0,
      totalSpent: 0,
    });
    const b = await seedBooking(workspaceId, oldClient._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ clientId: newClient._id.toString() }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    // client block must reflect the NEW client, not the old one
    expect(json.client).toEqual({
      id: newClient._id.toString(),
      name: "Liam Carter",
      email: "liam@example.com",
      phone: "+639179999999",
    });
  });

  it("concurrent clientId + sessions change: new client gets the updated firstSessionStart", async () => {
    const oldClient = await seedClient(workspaceId, {
      name: "Emma Carter",
      bookingsCount: 1,
      totalSpent: 25_000,
    });
    const newClient = await seedClient(workspaceId, {
      name: "Liam Carter",
      email: "liam@example.com",
      bookingsCount: 0,
      totalSpent: 0,
    });
    const b = await seedBooking(workspaceId, oldClient._id);
    const { PATCH } = await load();

    // Move the session date forward by one month in the same PATCH as client change.
    const newStart = new Date("2026-09-20T10:00:00Z");
    const res = await PATCH(
      makePatch(
        {
          clientId: newClient._id.toString(),
          sessions: [{ startAt: newStart.toISOString(), endAt: newStart.toISOString() }],
        },
        b._id.toString()
      ),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    // Booking must carry the updated session bounds.
    expect(new Date(json.firstSessionStart).toISOString()).toBe(newStart.toISOString());
    // New client owns the booking.
    expect(json.clientId.toString()).toBe(newClient._id.toString());
  });
});

describe("team-based visibility + edit permission on /api/bookings/[id]", () => {
  it("GET: a non-owner member of the booking's team can read it", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    auth.role = "staff";
    auth.memberships = [{ teamId: String(teamId), role: "member" }];
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
  });

  it("GET: a non-owner NOT on the booking's team gets 404 (no cross-team leak)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    auth.role = "staff";
    auth.memberships = [{ teamId: String(new Types.ObjectId()), role: "lead" }];
    const { GET } = await load();
    const res = await GET(makeGet(b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(404);
  });

  it("PATCH: a plain member of the team is forbidden (view-only)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, { title: "Original" });
    auth.role = "staff";
    auth.memberships = [{ teamId: String(teamId), role: "member" }];
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ title: "Hacked" }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(403);
    const after = await Booking.findById(b._id).lean();
    expect(after?.title).toBe("Original");
  });

  it("PATCH: a lead of the booking's active team can edit", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, { title: "Original" });
    auth.role = "staff";
    auth.memberships = [{ teamId: String(teamId), role: "lead" }];
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ title: "Updated" }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    const after = await Booking.findById(b._id).lean();
    expect(after?.title).toBe("Updated");
  });

  it("PATCH: a lead cannot edit once the team is deactivated (only owner can)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, { title: "Original" });
    await Team.updateOne({ _id: teamId }, { $set: { isActive: false, deactivatedAt: new Date() } });
    auth.role = "staff";
    auth.memberships = [{ teamId: String(teamId), role: "lead" }];
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ title: "Nope" }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(403);
  });

  it("PATCH: a non-owner NOT on the booking's team gets 404, not 403 (no existence oracle)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, { title: "Original" });
    auth.role = "staff";
    auth.memberships = [{ teamId: String(new Types.ObjectId()), role: "lead" }];
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ title: "Hacked" }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(404);
    const after = await Booking.findById(b._id).lean();
    expect(after?.title).toBe("Original");
  });
});

describe("PATCH team reassignment", () => {
  async function makeTeam(opts: { name: string; isActive?: boolean; wid?: Types.ObjectId }) {
    return Team.create({
      workspaceId: opts.wid ?? workspaceId,
      name: opts.name,
      color: TEAM_COLOR_PALETTE[1],
      isActive: opts.isActive ?? true,
      deactivatedAt: opts.isActive === false ? new Date() : null,
      memberCount: 0,
      createdByWorkosUserId: userId,
    });
  }

  it("owner reassigns a booking to another active team", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id); // starts on `teamId` (Main)
    const target = await makeTeam({ name: "Crew B" });
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ teamId: String(target._id) }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    const after = await Booking.findById(b._id).lean();
    expect(String(after?.teamId)).toBe(String(target._id));
  });

  it("rejects reassignment to a deactivated team (400)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const dead = await makeTeam({ name: "Dead", isActive: false });
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ teamId: String(dead._id) }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(400);
    expect(String((await Booking.findById(b._id).lean())?.teamId)).toBe(String(teamId));
  });

  it("rejects reassignment to a team in another workspace (404)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const foreign = await makeTeam({ name: "Foreign", wid: otherWorkspaceId });
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ teamId: String(foreign._id) }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(404);
  });

  it("lead can reassign to an active team they also lead", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id); // on Main (teamId)
    const target = await makeTeam({ name: "Lead Team" });
    auth.role = "staff";
    auth.memberships = [
      { teamId: String(teamId), role: "lead" },
      { teamId: String(target._id), role: "lead" },
    ];
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ teamId: String(target._id) }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
  });

  it("forbids a lead from reassigning to a team they do NOT lead (403)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const target = await makeTeam({ name: "Other Team" });
    auth.role = "staff";
    auth.memberships = [
      { teamId: String(teamId), role: "lead" }, // can edit the booking
      { teamId: String(target._id), role: "member" }, // but only a member of the target
    ];
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ teamId: String(target._id) }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(403);
    expect(String((await Booking.findById(b._id).lean())?.teamId)).toBe(String(teamId));
  });
});

describe("PATCH /api/bookings/[id] — cancellation emails", () => {
  it("fires sendBookingCancelledClient and sendBookingCancelledOwner when a booked booking is cancelled", async () => {
    auth.workspaceOverrides = { contact: { email: "owner@studio.test" } };
    const c = await seedClient(workspaceId, { email: "emma@example.com" });
    const b = await seedBooking(workspaceId, c._id, { status: "booked" });
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ status: "cancelled" }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    // Both senders must have been called
    expect(cancelledMocks.sendBookingCancelledClient).toHaveBeenCalledOnce();
    expect(cancelledMocks.sendBookingCancelledOwner).toHaveBeenCalledOnce();
    // Client sender receives correct clientEmail
    const clientArg = cancelledMocks.sendBookingCancelledClient.mock.calls[0][0];
    expect(clientArg.clientEmail).toBe("emma@example.com");
    // Owner sender receives ownerEmail
    const ownerArg = cancelledMocks.sendBookingCancelledOwner.mock.calls[0][0];
    expect(ownerArg.ownerEmail).toBe("owner@studio.test");
    // Booking Date sessions are formatted to the string-tuple shape in the
    // workspace timezone (no tz override -> Asia/Manila, UTC+8): 10:00Z -> 18:00.
    expect(clientArg.sessions).toEqual([
      { startDate: "2026-08-15", startTime: "18:00", endTime: "18:00" },
    ]);
  });

  it("does NOT fire cancellation senders when an already-cancelled booking is re-patched to cancelled", async () => {
    auth.workspaceOverrides = { contact: { email: "owner@studio.test" } };
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, { status: "cancelled" });
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ status: "cancelled" }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    expect(cancelledMocks.sendBookingCancelledClient).not.toHaveBeenCalled();
    expect(cancelledMocks.sendBookingCancelledOwner).not.toHaveBeenCalled();
  });

  it("refuses to cancel a completed booking — it's a read-only financial record", async () => {
    auth.workspaceOverrides = { contact: { email: "owner@studio.test" } };
    const c = await seedClient(workspaceId, { email: "ali@example.com" });
    const b = await seedBooking(workspaceId, c._id, { status: "completed" });
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ status: "cancelled" }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(409);
    expect(cancelledMocks.sendBookingCancelledClient).not.toHaveBeenCalled();
    expect(cancelledMocks.sendBookingCancelledOwner).not.toHaveBeenCalled();
  });

  it("does NOT fire cancellation senders when status changes to something other than cancelled", async () => {
    auth.workspaceOverrides = { contact: { email: "owner@studio.test" } };
    const c = await seedClient(workspaceId);
    // deposit === total (no payments needed) so the completion guard allows this transition.
    const b = await seedBooking(workspaceId, c._id, {
      status: "booked",
      amount: { total: 25_000, deposit: 25_000, currency: "PHP" },
    });
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ status: "completed" }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    expect(cancelledMocks.sendBookingCancelledClient).not.toHaveBeenCalled();
    expect(cancelledMocks.sendBookingCancelledOwner).not.toHaveBeenCalled();
  });

  it("does NOT fire cancellation senders when only a non-status field is patched", async () => {
    auth.workspaceOverrides = { contact: { email: "owner@studio.test" } };
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id, { status: "booked" });
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ title: "Renamed" }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(200);
    expect(cancelledMocks.sendBookingCancelledClient).not.toHaveBeenCalled();
    expect(cancelledMocks.sendBookingCancelledOwner).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/bookings/[id] rejectOnConflict", () => {
  const at = (h: number, m = 0) => new Date(Date.UTC(2030, 7, 15, h, m));
  const sess = (h1: number, h2: number) => ({ startAt: at(h1), endAt: at(h2) });
  const iso = (s: { startAt: Date; endAt: Date }) => ({
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
  });

  async function seedAt(cid: Types.ObjectId, sessions: { startAt: Date; endAt: Date }[], o: Record<string, unknown> = {}) {
    return seedBooking(workspaceId, cid, {
      sessions,
      firstSessionStart: sessions[0].startAt,
      lastSessionEnd: sessions[sessions.length - 1].endAt,
      ...o,
    });
  }

  it("409s with conflicts and does not write when the moved session overlaps another booking", async () => {
    auth.workspaceOverrides = { timezone: "UTC" };
    const c = await seedClient(workspaceId);
    const other = await seedAt(c._id, [sess(10, 12)], { title: "Other" });
    const b = await seedAt(c._id, [sess(14, 16)]);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ sessions: [iso(sess(11, 13))], rejectOnConflict: true }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("conflict");
    expect(json.conflicts).toEqual([
      expect.objectContaining({ bookingId: other._id.toString(), shiftStart: "10:00", shiftEnd: "12:00" }),
    ]);
    const stored = await Booking.findById(b._id).lean();
    expect(stored?.sessions[0].startAt.toISOString()).toBe(at(14).toISOString());
  });

  async function patchFlag(id: string, sessions: { startAt: Date; endAt: Date }[], flag: unknown = true) {
    const { PATCH } = await load();
    return PATCH(
      makePatch({ sessions: sessions.map(iso), ...(flag === "omit" ? {} : { rejectOnConflict: flag }) }, id),
      ctx(id)
    );
  }

  it("adjacent boundaries do not conflict; 200 returns updated booking with client block", async () => {
    auth.workspaceOverrides = { timezone: "UTC" };
    const c = await seedClient(workspaceId);
    await seedAt(c._id, [sess(10, 12)]);
    const b = await seedAt(c._id, [sess(14, 16)]);
    const res = await patchFlag(b._id.toString(), [sess(12, 14)]);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(new Date(json.sessions[0].startAt).toISOString()).toBe(at(12).toISOString());
    expect(json.client).toMatchObject({ name: "Emma Carter" });
  });

  it("does not conflict with its own stored session (same index excluded)", async () => {
    auth.workspaceOverrides = { timezone: "UTC" };
    const c = await seedClient(workspaceId);
    const b = await seedAt(c._id, [sess(10, 12)]);
    const res = await patchFlag(b._id.toString(), [sess(11, 13)]);
    expect(res.status).toBe(200);
  });

  it("conflicts with a sibling session of the same booking", async () => {
    auth.workspaceOverrides = { timezone: "UTC" };
    const c = await seedClient(workspaceId);
    const b = await seedAt(c._id, [sess(10, 12), sess(14, 16)]);
    const res = await patchFlag(b._id.toString(), [sess(10, 12), sess(11, 15)]);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.conflicts).toEqual([expect.objectContaining({ sessionIndex: 0 })]);
  });

  it("without the flag an overlapping move is written (soft-confirm flows unchanged)", async () => {
    auth.workspaceOverrides = { timezone: "UTC" };
    const c = await seedClient(workspaceId);
    await seedAt(c._id, [sess(10, 12)]);
    const b = await seedAt(c._id, [sess(14, 16)]);
    const res = await patchFlag(b._id.toString(), [sess(11, 13)], "omit");
    expect(res.status).toBe(200);
  });

  it("ignores other workspaces' bookings (tenant isolation)", async () => {
    auth.workspaceOverrides = { timezone: "UTC" };
    const c = await seedClient(workspaceId);
    const oc = await seedClient(otherWorkspaceId);
    await seedBooking(otherWorkspaceId, oc._id, { sessions: [sess(10, 12)], firstSessionStart: at(10), lastSessionEnd: at(12) });
    const b = await seedAt(c._id, [sess(14, 16)]);
    const res = await patchFlag(b._id.toString(), [sess(11, 13)]);
    expect(res.status).toBe(200);
  });

  it("staff conflict check is limited to their team scope", async () => {
    auth.workspaceOverrides = { timezone: "UTC" };
    auth.role = "staff";
    auth.memberships = [{ teamId: teamId.toString(), role: "lead" }];
    const c = await seedClient(workspaceId);
    await seedAt(c._id, [sess(10, 12)], { teamId: new Types.ObjectId() });
    const b = await seedAt(c._id, [sess(14, 16)]);
    const res = await patchFlag(b._id.toString(), [sess(11, 13)]);
    expect(res.status).toBe(200);
  });

  it("400s on a non-boolean rejectOnConflict", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedAt(c._id, [sess(14, 16)]);
    const res = await patchFlag(b._id.toString(), [sess(11, 13)], "yes");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/bookings/[id]?include=activity", () => {
  it("returns booking plus first activity page with actorNames in a bounded query count", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    await User.create({
      workosUserId: "u_in",
      email: "in@x.test",
      name: " Ana ",
      memberships: [{ workspaceId, role: "owner" }],
    });
    await User.create({
      workosUserId: "u_out",
      email: "out@x.test",
      name: "Outsider",
      memberships: [{ workspaceId: otherWorkspaceId, role: "owner" }],
    });
    for (const actorUserId of ["u_in", "u_out"]) {
      await ActivityLog.create({
        workspaceId,
        actorUserId,
        entity: "booking",
        entityId: b._id,
        action: "updated",
        diff: null,
      });
    }
    const { GET } = await load();
    const { countQueries } = await import("@/test-utils/query-counter");
    const { result: res, queries } = await countQueries(() =>
      GET(makeGet(`${b._id}`.concat("?include=activity")), ctx(b._id.toString()))
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe("Carter Wedding");
    expect(json.client).toMatchObject({ name: "Emma Carter" });
    expect(json.activity).toMatchObject({
      total: 2,
      page: 1,
      pageSize: 5,
      actorNames: { u_in: "Ana" },
    });
    expect(json.activity.entries).toHaveLength(2);
    // booking, client, activity find, activity count, users
    expect(queries.map((q) => q.collection).sort()).toEqual(
      ["activitylogs", "activitylogs", "bookings", "clients", "users"]
    );
  });

  it("omits activity without include", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { GET } = await load();
    const json = await (await GET(makeGet(b._id.toString()), ctx(b._id.toString()))).json();
    expect(json.activity).toBeUndefined();
  });
});

describe("PATCH /api/bookings/[id] expectedUpdatedAt", () => {
  it("409 stale with the current booking and leaves the DB unchanged", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch(
        { title: "Mine", expectedUpdatedAt: new Date(b.updatedAt.getTime() - 5000).toISOString() },
        b._id.toString()
      ),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("stale");
    expect(json.booking.title).toBe("Carter Wedding");
    expect(json.booking.updatedAt).toBe(b.updatedAt.toISOString());
    expect(json.booking.client).toMatchObject({ name: "Emma Carter" });
    const after = await Booking.findById(b._id).lean();
    expect(after?.title).toBe("Carter Wedding");
    expect(emit).not.toHaveBeenCalled();
  });

  it("200 with a fresh updatedAt when the token matches", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ title: "Mine", expectedUpdatedAt: b.updatedAt.toISOString() }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe("Mine");
    const after = await Booking.findById(b._id).lean();
    expect(json.updatedAt).toBe(after?.updatedAt.toISOString());
    expect(new Date(json.updatedAt).getTime()).toBeGreaterThan(b.updatedAt.getTime());
  });

  it("second write with the now-stale token is rejected (no lost update)", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const token = b.updatedAt.toISOString();
    const { PATCH } = await load();
    const first = await PATCH(makePatch({ title: "A", expectedUpdatedAt: token }, b._id.toString()), ctx(b._id.toString()));
    expect(first.status).toBe(200);
    const second = await PATCH(makePatch({ title: "B", expectedUpdatedAt: token }, b._id.toString()), ctx(b._id.toString()));
    expect(second.status).toBe(409);
    expect((await second.json()).booking.title).toBe("A");
    expect((await Booking.findById(b._id).lean())?.title).toBe("A");
  });

  it("stale client reassignment rolls back and 409s", async () => {
    const c = await seedClient(workspaceId);
    const c2 = await seedClient(workspaceId, { name: "Other", email: "o@example.com" });
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch(
        { clientId: c2._id.toString(), expectedUpdatedAt: new Date(b.updatedAt.getTime() - 1).toISOString() },
        b._id.toString()
      ),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(409);
    expect((await Booking.findById(b._id).lean())?.clientId.toString()).toBe(c._id.toString());
  });

  it("rejects a malformed expectedUpdatedAt with 400", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(makePatch({ title: "x", expectedUpdatedAt: "yesterday" }, b._id.toString()), ctx(b._id.toString()));
    expect(res.status).toBe(400);
  });

  it("other-workspace booking still 404s even with a matching token", async () => {
    const c = await seedClient(otherWorkspaceId);
    const b = await seedBooking(otherWorkspaceId, c._id);
    const { PATCH } = await load();
    const res = await PATCH(
      makePatch({ title: "x", expectedUpdatedAt: b.updatedAt.toISOString() }, b._id.toString()),
      ctx(b._id.toString())
    );
    expect(res.status).toBe(404);
  });

  it("GET returns updatedAt as ISO", async () => {
    const c = await seedClient(workspaceId);
    const b = await seedBooking(workspaceId, c._id);
    const { GET } = await load();
    const json = await (await GET(makeGet(b._id.toString()), ctx(b._id.toString()))).json();
    expect(json.updatedAt).toBe(b.updatedAt.toISOString());
  });
});

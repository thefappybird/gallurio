import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Booking, Client, ActivityLog } from "@/lib/db/models";

const workspaceId = new Types.ObjectId();
const userId = "user_test";

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId,
    clerkOrgId: "org_test",
    role: "owner",
    workspace: { _id: workspaceId, currency: "PHP", name: "Test", slug: "t" },
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

async function load() {
  return import("./route");
}

function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    client: { mode: "new", name: "Emma Carter", email: "emma@example.com" },
    title: "Carter Wedding",
    eventType: "wedding",
    status: "booked",
    sessions: [
      {
        startAt: new Date("2026-08-15T10:00:00Z").toISOString(),
        endAt: new Date("2026-08-15T18:00:00Z").toISOString(),
      },
    ],
    location: { address: "100 Ayala Ave" },
    amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
    notes: "",
    ...overrides,
  };
}

function makeReq(body: unknown) {
  return new Request("http://test/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bookings", () => {
  it("creates a booking + a client + an activity log on a new-client payload", async () => {
    const { POST } = await load();
    const res = await POST(makeReq(makeBody()));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(typeof json.id).toBe("string");

    const booking = await Booking.findOne({ workspaceId }).lean();
    expect(booking?.title).toBe("Carter Wedding");
    expect(booking?.clientName).toBe("Emma Carter");
    expect(booking?.amount?.currency).toBe("PHP");

    const client = await Client.findOne({ workspaceId }).lean();
    expect(client?.email).toBe("emma@example.com");

    const log = await ActivityLog.findOne({ workspaceId, entity: "booking" }).lean();
    expect(log?.action).toBe("created");
  });

  it("returns 400 on missing required field", async () => {
    const { POST } = await load();
    const res = await POST(makeReq(makeBody({ title: "" })));
    expect(res.status).toBe(400);
  });

  it("returns 400 when deposit exceeds total (Zod refine)", async () => {
    const { POST } = await load();
    const res = await POST(
      makeReq(makeBody({ amount: { total: 1000, deposit: 9999, currency: "PHP" } }))
    );
    expect(res.status).toBe(400);
  });

  it("reuses an existing client when mode='existing' and ownership matches", async () => {
    const existing = await Client.create({
      workspaceId,
      name: "Priya Shah",
      email: "priya@example.com",
    });
    const { POST } = await load();
    const res = await POST(
      makeReq(makeBody({ client: { mode: "existing", clientId: existing._id.toString() } }))
    );
    expect(res.status).toBe(201);
    const booking = await Booking.findOne({ workspaceId }).lean();
    expect(booking?.clientName).toBe("Priya Shah");
    expect(await Client.countDocuments({ workspaceId })).toBe(1);
  });

  it("returns 404 when existing clientId belongs to a different workspace (tenant isolation)", async () => {
    const otherWid = new Types.ObjectId();
    const other = await Client.create({
      workspaceId: otherWid,
      name: "Stranger",
      email: "x@example.com",
    });
    const { POST } = await load();
    const res = await POST(
      makeReq(makeBody({ client: { mode: "existing", clientId: other._id.toString() } }))
    );
    expect(res.status).toBe(404);
    expect(await Booking.countDocuments({ workspaceId })).toBe(0);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Booking, ActivityLog, User } from "@/lib/db/models";

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();
const auth = vi.hoisted(() => ({ role: "owner" as "owner" | "staff" }));

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({
    userId: "u_actor",
    role: auth.role,
    workspace: { _id: workspaceId },
  }),
}));
vi.mock("@/lib/auth/teamContext", () => ({ getTeamsForUser: async () => [] }));

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
  auth.role = "owner";
});

async function seed() {
  const start = new Date("2030-08-15T10:00:00Z");
  const b = await Booking.create({
    workspaceId,
    teamId: new Types.ObjectId(),
    clientId: new Types.ObjectId(),
    clientName: "C",
    title: "T",
    status: "booked",
    sessions: [{ startAt: start, endAt: start }],
    firstSessionStart: start,
    lastSessionEnd: start,
    amount: { total: 0, deposit: 0, currency: "PHP" },
  });
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
  for (const actor of ["u_in", "u_out"]) {
    await ActivityLog.create({
      workspaceId,
      actorUserId: actor,
      entity: "booking",
      entityId: b._id,
      action: "updated",
      diff: null,
    });
  }
  return b;
}

async function get(id: string, qs = "") {
  const { GET } = await import("./route");
  return GET(new Request(`http://test/api/bookings/${id}/activity${qs}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/bookings/[id]/activity", () => {
  it("returns actorNames for the page, excluding non-members", async () => {
    const b = await seed();
    const res = await get(b._id.toString());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(2);
    expect(json.actorNames).toEqual({ u_in: "Ana" });
  });

  it("404s for a booking in another workspace", async () => {
    const b = await seed();
    await Booking.updateOne({ _id: b._id }, { workspaceId: otherWorkspaceId });
    const res = await get(b._id.toString());
    expect(res.status).toBe(404);
  });

  it("400s for an invalid id", async () => {
    const res = await get("nope");
    expect(res.status).toBe(400);
  });
});

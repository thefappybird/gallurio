import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import type { Server } from "socket.io";
import { setIO } from "./io";
import { emitDataChanged } from "./emitDataChanged";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { TeamMembership, User, Workspace } from "@/lib/db/models";

afterEach(() => {
  global.__io = undefined;
  vi.restoreAllMocks();
});

describe("emitDataChanged", () => {
  it("emits data:changed to the workspace room with type-only payload", () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    setIO({ to } as unknown as Server);

    emitDataChanged("ws1", { type: "booking.created", bookingId: "b1" });

    expect(to).toHaveBeenCalledWith("workspace:ws1");
    expect(emit).toHaveBeenCalledWith("data:changed", {
      workspaceId: "ws1",
      event: { type: "booking.created", bookingId: "b1" },
      at: expect.any(Number),
    });
  });

  it("catches and logs a throwing io", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    setIO({
      to: () => {
        throw new Error("boom");
      },
    } as unknown as Server);

    expect(() => emitDataChanged("ws1", { type: "workspace.updated" })).not.toThrow();
    expect(err).toHaveBeenCalled();
  });

  it("is a no-op when io is undefined", () => {
    expect(() => emitDataChanged("ws1", { type: "workspace.updated" })).not.toThrow();
  });
});

type Call = {
  rooms: string | string[];
  except: string[];
  event: string;
  payload: { workspaceId: string; event: { type: string; clientId?: string | null } };
};

function fakeIo() {
  const calls: Call[] = [];
  const io = {
    to(rooms: string | string[]) {
      const c = { rooms, except: [] as string[] };
      const api = {
        except(r: string[]) {
          c.except = r;
          return api;
        },
        emit(event: string, payload: unknown) {
          calls.push({ ...c, event, payload });
        },
      };
      return api;
    },
  };
  setIO(io as unknown as Server);
  return calls;
}

describe("emitDataChanged team-scoped booking events", () => {
  const wsOid = new Types.ObjectId();
  const ws = String(wsOid);
  const teamA = new Types.ObjectId();
  const teamB = new Types.ObjectId();
  const teamC = new Types.ObjectId();

  beforeAll(startInMemoryMongo);
  afterAll(stopInMemoryMongo);
  beforeEach(async () => {
    await clearCollections();
    await Workspace.collection.insertOne({ _id: wsOid, ownerUserId: "owner1" });
    await User.collection.insertMany([
      { workosUserId: "coowner", memberships: [{ workspaceId: wsOid, role: "owner" }] },
      { workosUserId: "staff1", memberships: [{ workspaceId: wsOid, role: "staff" }] },
      { workosUserId: "otherWsOwner", memberships: [{ workspaceId: new Types.ObjectId(), role: "owner" }] },
    ]);
    await TeamMembership.create([
      { workspaceId: wsOid, teamId: teamA, workosUserId: "memberA" },
      { workspaceId: wsOid, teamId: teamB, workosUserId: "memberB" },
      { workspaceId: wsOid, teamId: teamC, workosUserId: "memberC" },
      { workspaceId: new Types.ObjectId(), teamId: teamA, workosUserId: "foreignMemberA" },
    ]);
  });

  const event = { type: "booking.updated", bookingId: "b1", clientId: "c1" } as const;

  it("sends the full event to owners + team members and only client.statsChanged to everyone else", async () => {
    const calls = fakeIo();
    emitDataChanged(ws, event, { teamIds: [String(teamA)] });
    await vi.waitFor(() => expect(calls).toHaveLength(2));

    const full = calls.find((c) => c.payload.event.type === "booking.updated")!;
    expect([...(full.rooms as string[])].sort()).toEqual(["user:coowner", "user:memberA", "user:owner1"]);
    expect(full.payload.workspaceId).toBe(ws);

    const stats = calls.find((c) => c.payload.event.type === "client.statsChanged")!;
    expect(stats.rooms).toBe(`workspace:${ws}`);
    expect([...stats.except].sort()).toEqual(["user:coowner", "user:memberA", "user:owner1"]);
    expect(stats.payload.event).toEqual({ type: "client.statsChanged", clientId: "c1" });
  });

  it("reassignment: old and new teams both receive the full event, others do not", async () => {
    const calls = fakeIo();
    emitDataChanged(ws, event, { teamIds: [String(teamA), String(teamB), null, undefined] });
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    const full = calls.find((c) => c.payload.event.type === "booking.updated")!;
    expect(full.rooms).toEqual(expect.arrayContaining(["user:memberA", "user:memberB", "user:owner1"]));
    expect(full.rooms).not.toContain("user:memberC");
    expect(full.rooms).not.toContain("user:foreignMemberA");
    expect(full.rooms).not.toContain("user:otherWsOwner");
    expect(full.rooms).not.toContain("user:staff1");
  });

  it("team-less booking (null teamIds) goes to owners only; statsChanged carries a null clientId", async () => {
    const calls = fakeIo();
    emitDataChanged(ws, { type: "booking.created", bookingId: "b1" }, { teamIds: [null] });
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    const full = calls.find((c) => c.payload.event.type === "booking.created")!;
    expect([...(full.rooms as string[])].sort()).toEqual(["user:coowner", "user:owner1"]);
    const stats = calls.find((c) => c.payload.event.type === "client.statsChanged")!;
    expect(stats.payload.event).toEqual({ type: "client.statsChanged", clientId: null });
  });

  it("falls back to the full workspace broadcast when audience resolution fails", async () => {
    const calls = fakeIo();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const unknownWs = String(new Types.ObjectId());
    emitDataChanged(unknownWs, event, { teamIds: [String(teamA)] });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].rooms).toBe(`workspace:${unknownWs}`);
    expect(calls[0].payload.event).toEqual(event);
    expect(calls[0].except).toEqual([]);
  });

  it("broadcasts synchronously to the workspace room without teamIds or for non-booking events", () => {
    const calls = fakeIo();
    emitDataChanged(ws, event);
    emitDataChanged(ws, { type: "client.updated", clientId: "c1" }, { teamIds: [String(teamA)] });
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.rooms === `workspace:${ws}`)).toBe(true);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { TeamMembership } from "@/lib/db/models/teamMembership";
import { getTeamsForUser, isLeadOnTeam, isOnTeam } from "./teamContext";

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await TeamMembership.deleteMany({});
});

describe("getTeamsForUser", () => {
  it("returns empty array when no memberships exist", async () => {
    const result = await getTeamsForUser(new mongoose.Types.ObjectId(), "user_a");
    expect(result).toEqual([]);
  });

  it("returns only memberships scoped to the requested workspace + user", async () => {
    const ws = new mongoose.Types.ObjectId();
    const otherWs = new mongoose.Types.ObjectId();
    const team1 = new mongoose.Types.ObjectId();
    const team2 = new mongoose.Types.ObjectId();
    const otherTeam = new mongoose.Types.ObjectId();

    await TeamMembership.create([
      { workspaceId: ws, teamId: team1, workosUserId: "user_a", role: "lead" },
      { workspaceId: ws, teamId: team2, workosUserId: "user_a", role: "member" },
      { workspaceId: ws, teamId: team1, workosUserId: "user_b", role: "member" },
      { workspaceId: otherWs, teamId: otherTeam, workosUserId: "user_a", role: "lead" },
    ]);

    const result = await getTeamsForUser(ws, "user_a");
    expect(result).toHaveLength(2);
    const sorted = result.sort((a, b) => a.teamId.localeCompare(b.teamId));
    const ids = sorted.map((m) => m.teamId).sort();
    expect(ids).toEqual([String(team1), String(team2)].sort());
    expect(isLeadOnTeam(result, String(team1))).toBe(true);
    expect(isLeadOnTeam(result, String(team2))).toBe(false);
    expect(isOnTeam(result, String(team1))).toBe(true);
    expect(isOnTeam(result, String(otherTeam))).toBe(false);
  });

  it("accepts a string workspaceId", async () => {
    const ws = new mongoose.Types.ObjectId();
    await TeamMembership.create({
      workspaceId: ws,
      teamId: new mongoose.Types.ObjectId(),
      workosUserId: "user_a",
      role: "member",
    });
    const result = await getTeamsForUser(String(ws), "user_a");
    expect(result).toHaveLength(1);
  });

  it("guards against missing inputs", async () => {
    expect(await getTeamsForUser("", "user_a")).toEqual([]);
    expect(
      await getTeamsForUser(new mongoose.Types.ObjectId(), ""),
    ).toEqual([]);
  });
});

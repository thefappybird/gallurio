import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Team } from "@/lib/db/models/team";
import {
  TeamNotFoundError,
  TeamSeatCapExceededError,
  assertCanAddTeamMember,
  releaseTeamSeat,
} from "./assertCanAddTeamMember";

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
  await Team.deleteMany({});
});

async function makeTeam(memberCount = 0) {
  return Team.create({
    workspaceId: new mongoose.Types.ObjectId(),
    name: `Team ${Math.random().toString(36).slice(2, 8)}`,
    color: "#112233",
    isDefault: false,
    memberCount,
    createdByWorkosUserId: "user_test",
  });
}

describe("assertCanAddTeamMember", () => {
  it("increments memberCount when under cap (happy path)", async () => {
    const team = await makeTeam(3);
    await assertCanAddTeamMember(team._id, "free");
    const fresh = await Team.findById(team._id).lean();
    expect(fresh?.memberCount).toBe(4);
  });

  it("throws TeamSeatCapExceededError when at cap", async () => {
    const team = await makeTeam(10);
    await expect(assertCanAddTeamMember(team._id, "free")).rejects.toBeInstanceOf(
      TeamSeatCapExceededError,
    );
    const fresh = await Team.findById(team._id).lean();
    expect(fresh?.memberCount).toBe(10);
  });

  it("throws TeamNotFoundError for unknown team", async () => {
    await expect(
      assertCanAddTeamMember(new mongoose.Types.ObjectId(), "pro"),
    ).rejects.toBeInstanceOf(TeamNotFoundError);
  });

  it("only one of two concurrent invites wins at the last seat", async () => {
    const team = await makeTeam(9);
    const results = await Promise.allSettled([
      assertCanAddTeamMember(team._id, "free"),
      assertCanAddTeamMember(team._id, "free"),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      TeamSeatCapExceededError,
    );
    const fresh = await Team.findById(team._id).lean();
    expect(fresh?.memberCount).toBe(10);
  });

  it("releaseTeamSeat decrements memberCount", async () => {
    const team = await makeTeam(5);
    await releaseTeamSeat(team._id);
    const fresh = await Team.findById(team._id).lean();
    expect(fresh?.memberCount).toBe(4);
  });

  it("releaseTeamSeat does not go below zero", async () => {
    const team = await makeTeam(0);
    await releaseTeamSeat(team._id);
    const fresh = await Team.findById(team._id).lean();
    expect(fresh?.memberCount).toBe(0);
  });
});

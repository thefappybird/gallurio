import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));

import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { User } from "@/lib/db/models";
import { resolveActorNames } from "./actor-names";

const workspaceId = new Types.ObjectId();

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

function mkUser(workosUserId: string, name: string, wid: Types.ObjectId | null) {
  return User.create({
    workosUserId,
    email: `${workosUserId}@x.test`,
    name,
    memberships: wid ? [{ workspaceId: wid, role: "staff" }] : [],
  });
}

describe("resolveActorNames", () => {
  it("returns trimmed names for workspace members only", async () => {
    await mkUser("u_in", "  Ana  ", workspaceId);
    await mkUser("u_out", "Outsider", new Types.ObjectId());
    await mkUser("u_blank", "   ", workspaceId);
    const names = await resolveActorNames(workspaceId, ["u_in", "u_out", "u_blank", "u_missing"]);
    expect(names).toEqual({ u_in: "Ana" });
  });
});

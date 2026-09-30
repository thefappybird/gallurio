import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { User } from "@/lib/db/models";

const workspaceId = new Types.ObjectId();

vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => ({ userId: "u", role: "owner", workspace: { _id: workspaceId } }),
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

describe("GET /api/users/names", () => {
  it("returns names for workspace members only", async () => {
    await User.create({ workosUserId: "a", email: "a@x.test", name: "Ana", memberships: [{ workspaceId, role: "staff" }] });
    await User.create({ workosUserId: "b", email: "b@x.test", name: "Bob", memberships: [] });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://test/api/users/names?ids=a&ids=b"));
    expect(await res.json()).toEqual({ a: "Ana" });
  });
});

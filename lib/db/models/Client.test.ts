import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Client } from "@/lib/db/models";
import { Types } from "mongoose";

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
afterEach(async () => { await clearCollections(); });

describe("Client model", () => {
  it("sets isActive to true by default", async () => {
    const c = await Client.create({
      workspaceId: new Types.ObjectId(),
      name: "Test Client",
    });
    expect(c.isActive).toBe(true);
  });

  it("can be set to inactive", async () => {
    const wid = new Types.ObjectId();
    const c = await Client.create({ workspaceId: wid, name: "Test" });
    await Client.findByIdAndUpdate(c._id, { isActive: false });
    const updated = await Client.findById(c._id).lean();
    expect(updated?.isActive).toBe(false);
  });
});

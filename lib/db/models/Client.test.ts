import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Client } from "@/lib/db/models";

beforeAll(() => startInMemoryMongo());
afterAll(() => stopInMemoryMongo());
afterEach(() => clearCollections());

describe("Client model", () => {
  it("sets isActive to true by default", async () => {
    const c = await Client.create({
      workspaceId: new (await import("mongoose")).default.Types.ObjectId(),
      name: "Test Client",
    });
    expect(c.isActive).toBe(true);
  });

  it("can be set to inactive", async () => {
    const wid = new (await import("mongoose")).default.Types.ObjectId();
    const c = await Client.create({ workspaceId: wid, name: "Test" });
    await Client.findByIdAndUpdate(c._id, { isActive: false });
    const updated = await Client.findById(c._id).lean();
    expect(updated?.isActive).toBe(false);
  });
});

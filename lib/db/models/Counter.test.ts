import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Counter } from "@/lib/db/models";
import { Types } from "mongoose";

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
afterEach(async () => { await clearCollections(); });

describe("Counter model", () => {
  it("defaults seq to 0", async () => {
    const c = await Counter.create({ workspaceId: new Types.ObjectId(), key: "invoice" });
    expect(c.seq).toBe(0);
  });
});

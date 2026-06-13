import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { User } from "@/lib/db/models";

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
afterEach(async () => { await clearCollections(); });

describe("User.timeFormat", () => {
  it("defaults to 24h", async () => {
    const u = await User.create({ workosUserId: "user_tf1", email: "tf1@example.com" });
    expect(u.timeFormat).toBe("24h");
  });

  it("accepts 12h", async () => {
    const u = await User.create({
      workosUserId: "user_tf2",
      email: "tf2@example.com",
      timeFormat: "12h",
    });
    expect(u.timeFormat).toBe("12h");
  });

  it("rejects invalid value", async () => {
    await expect(
      User.create({ workosUserId: "user_tf3", email: "tf3@example.com", timeFormat: "invalid" })
    ).rejects.toThrow();
  });

  it("can be updated from 24h to 12h", async () => {
    const u = await User.create({ workosUserId: "user_tf4", email: "tf4@example.com" });
    await User.findByIdAndUpdate(u._id, { timeFormat: "12h" });
    const updated = await User.findById(u._id).lean();
    expect(updated?.timeFormat).toBe("12h");
  });
});

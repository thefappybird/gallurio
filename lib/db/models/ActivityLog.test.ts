import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { ActivityLog } from "@/lib/db/models";
import { Types } from "mongoose";

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
afterEach(async () => { await clearCollections(); });

describe("ActivityLog model — action enum", () => {
  it("accepts action: 'payment_added'", async () => {
    const doc = await ActivityLog.create({
      workspaceId: new Types.ObjectId(),
      actorUserId: "user_1",
      entity: "booking",
      action: "payment_added",
    });
    expect(doc.action).toBe("payment_added");
  });

  it("accepts action: 'payment_updated'", async () => {
    const doc = await ActivityLog.create({
      workspaceId: new Types.ObjectId(),
      actorUserId: "user_1",
      entity: "booking",
      action: "payment_updated",
    });
    expect(doc.action).toBe("payment_updated");
  });
});

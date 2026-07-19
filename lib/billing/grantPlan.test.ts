import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";
import { grantPlan } from "./grantPlan";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
afterEach(async () => {
  await clearCollections();
});

describe("grantPlan", () => {
  it("clears stale ls* fields left over from a prior real Lemon Squeezy subscription", async () => {
    const ws = await Workspace.create({
      slug: "ex-subscriber",
      name: "Ex Subscriber",
      ownerUserId: "wos_ex_subscriber",
      plan: "pro",
      lsSubscriptionStatus: "active",
      lsSubscriptionId: "sub_real_123",
      lsCustomerId: "cus_real_123",
      lsCurrentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await grantPlan(ws._id, { plan: "beta", expiresAt: null });

    const updated = await Workspace.findById(ws._id).lean();
    expect(updated?.plan).toBe("beta");
    expect(updated?.lsSubscriptionStatus).toBeNull();
    expect(updated?.lsSubscriptionId).toBeNull();
    expect(updated?.lsCustomerId).toBeNull();
    expect(updated?.lsCurrentPeriodEnd).toBeNull();
  });
});

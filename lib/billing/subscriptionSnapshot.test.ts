import { afterAll, beforeAll, beforeEach, describe, it, expect } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";

// lib/lemonsqueezy/plans.ts reads these env vars at module-eval time — set
// before the dynamic import below (a static import would be hoisted ahead
// of this assignment and capture empty variant ids).
process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID = "1001";
process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID = "1002";

async function loadApplySubscriptionSnapshot() {
  return (await import("./subscriptionSnapshot")).applySubscriptionSnapshot;
}

describe("applySubscriptionSnapshot", () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  }, 120_000);

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it("promotes plan to pro and sets subscription fields on an active snapshot", async () => {
    const ws = await Workspace.create({
      slug: "snap-1",
      name: "Snapshot WS",
      ownerUserId: "user_1",
      plan: "free",
    });

    const applySubscriptionSnapshot = await loadApplySubscriptionSnapshot();
    await applySubscriptionSnapshot({
      filter: { _id: ws._id },
      subscriptionId: "sub_1",
      customerId: "cust_1",
      rawStatus: "active",
      variantId: "1001",
      renewsAt: "2026-08-01T00:00:00Z",
      eventTimestamp: null,
    });

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionId).toBe("sub_1");
    expect(after?.lsCustomerId).toBe("cust_1");
    expect(after?.lsSubscriptionStatus).toBe("active");
    expect(after?.lsCurrentPeriodEnd).toBeInstanceOf(Date);
    expect(after?.everSubscribed).toBe(true);
    expect(after?.lsVariantId).toBe("1001");
  });

  it("persists lsVariantId even when the team-cap guard refuses to promote the plan", async () => {
    const { Team, TEAM_COLOR_PALETTE } = await import("@/lib/db/models/team");
    const ws = await Workspace.create({
      slug: "snap-6",
      name: "Snapshot WS 6",
      ownerUserId: "user_1",
      plan: "free",
    });
    for (let i = 0; i < 20; i++) {
      await Team.create({
        workspaceId: ws._id,
        name: `Team ${i + 1}`,
        color: TEAM_COLOR_PALETTE[i % TEAM_COLOR_PALETTE.length],
        isDefault: i === 0,
        memberCount: 0,
        createdByWorkosUserId: "user_1",
      });
    }

    const applySubscriptionSnapshot = await loadApplySubscriptionSnapshot();
    await applySubscriptionSnapshot({
      filter: { _id: ws._id },
      subscriptionId: "sub_6",
      customerId: "cust_6",
      rawStatus: "active",
      variantId: "1001",
      renewsAt: null,
      eventTimestamp: null,
    });

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("free");
    expect(after?.lsVariantId).toBe("1001");
  });

  it("refuses to promote when the workspace exceeds the new tier's team cap", async () => {
    const { Team, TEAM_COLOR_PALETTE } = await import("@/lib/db/models/team");
    const ws = await Workspace.create({
      slug: "snap-2",
      name: "Snapshot WS 2",
      ownerUserId: "user_1",
      plan: "free",
    });
    for (let i = 0; i < 20; i++) {
      await Team.create({
        workspaceId: ws._id,
        name: `Team ${i + 1}`,
        color: TEAM_COLOR_PALETTE[i % TEAM_COLOR_PALETTE.length],
        isDefault: i === 0,
        memberCount: 0,
        createdByWorkosUserId: "user_1",
      });
    }

    const applySubscriptionSnapshot = await loadApplySubscriptionSnapshot();
    await applySubscriptionSnapshot({
      filter: { _id: ws._id },
      subscriptionId: "sub_2",
      customerId: "cust_2",
      rawStatus: "active",
      variantId: "1001",
      renewsAt: null,
      eventTimestamp: null,
    });

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("free");
    expect(after?.everSubscribed).toBe(false);
    // Non-plan fields still apply.
    expect(after?.lsSubscriptionId).toBe("sub_2");
    expect(after?.lsSubscriptionStatus).toBe("active");
  });

  it("refuses to re-promote a workspace when the mapped status is terminal (canceled), even with a paid variantId", async () => {
    const ws = await Workspace.create({
      slug: "snap-3",
      name: "Snapshot WS 3",
      ownerUserId: "user_1",
      plan: "free",
      everSubscribed: true,
    });

    const applySubscriptionSnapshot = await loadApplySubscriptionSnapshot();
    await applySubscriptionSnapshot({
      filter: { _id: ws._id },
      subscriptionId: "sub_3",
      customerId: "cust_3",
      rawStatus: "expired",
      variantId: "1001",
      renewsAt: null,
      eventTimestamp: null,
    });

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("free");
    expect(after?.lsSubscriptionStatus).toBe("canceled");
  });

  it("does not downgrade an existing pro workspace when variantId resolves to no plan match (env unset)", async () => {
    const ws = await Workspace.create({
      slug: "snap-4",
      name: "Snapshot WS 4",
      ownerUserId: "user_1",
      plan: "pro",
      everSubscribed: true,
    });

    const applySubscriptionSnapshot = await loadApplySubscriptionSnapshot();
    await applySubscriptionSnapshot({
      filter: { _id: ws._id },
      subscriptionId: "sub_4",
      customerId: "cust_4",
      rawStatus: "active",
      variantId: "unknown_variant",
      renewsAt: null,
      eventTimestamp: null,
    });

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("pro");
  });

  it("does not overwrite an existing lsCustomerId with null when the snapshot omits customer_id", async () => {
    const ws = await Workspace.create({
      slug: "snap-5",
      name: "Snapshot WS 5",
      ownerUserId: "user_1",
      plan: "pro",
      lsCustomerId: "cust_existing",
    });

    const applySubscriptionSnapshot = await loadApplySubscriptionSnapshot();
    await applySubscriptionSnapshot({
      filter: { _id: ws._id },
      subscriptionId: "sub_5",
      customerId: null,
      rawStatus: "active",
      variantId: "1001",
      renewsAt: null,
      eventTimestamp: null,
    });

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.lsCustomerId).toBe("cust_existing");
  });
});

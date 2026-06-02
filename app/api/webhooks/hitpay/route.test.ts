import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("@/lib/hitpay/webhook", () => ({
  verifyHitpayCallback: () => true,
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

async function loadRoute() {
  return import("./route");
}

async function seedWorkspace(opts: {
  plan: "free" | "starter" | "pro";
  hitpayRecurringBillingId: string;
  teamCount: number;
}): Promise<Types.ObjectId> {
  const ws = await Workspace.create({
    clerkOrgId: `org_${Math.random().toString(36).slice(2, 10)}`,
    ownerUserId: "user_owner",
    name: "Test",
    slug: `t-${Math.random().toString(36).slice(2, 8)}`,
    plan: opts.plan,
    hitpayRecurringBillingId: opts.hitpayRecurringBillingId,
    hitpayRecurringStatus: "active",
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    businessType: "photographer",
  });
  for (let i = 0; i < opts.teamCount; i++) {
    await Team.create({
      workspaceId: ws._id,
      name: `Team ${i + 1}`,
      color: TEAM_COLOR_PALETTE[i % TEAM_COLOR_PALETTE.length],
      isDefault: i === 0,
      memberCount: 0,
      createdByClerkUserId: "user_owner",
    });
  }
  return ws._id;
}

function makeReq(body: unknown) {
  return new Request("http://test/api/webhooks/hitpay", {
    method: "POST",
    headers: { "content-type": "application/json", "hitpay-signature": "stub" },
    body: JSON.stringify(body),
  });
}

describe("hitpay webhook — subscription cancellation guard", () => {
  it("downgrades plan to free when subscription is cancelled even if over the new cap", async () => {
    // Pro plan workspace with 5 teams (above the free cap of 1). The previous
    // guard refused to downgrade in this case, leaving cancelled accounts on
    // paid entitlements (billing leak). New behavior: always downgrade on
    // cancellation; the over-cap state is surfaced in the UI.
    const billingId = "rb_test_cancel_over_cap";
    const wsId = await seedWorkspace({
      plan: "pro",
      hitpayRecurringBillingId: billingId,
      teamCount: 5,
    });

    const { POST } = await loadRoute();
    const res = await POST(
      makeReq({
        type: "recurring_billing.subscription_updated",
        data: { id: billingId, status: "cancelled" },
      }),
    );
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
    expect(after?.hitpayRecurringStatus).toBe("cancelled");
    expect(after?.hitpayCurrentPeriodEnd).toBeNull();
  });

  it("downgrades on closed status as well", async () => {
    const billingId = "rb_test_closed_over_cap";
    const wsId = await seedWorkspace({
      plan: "starter",
      hitpayRecurringBillingId: billingId,
      teamCount: 3,
    });
    const { POST } = await loadRoute();
    await POST(
      makeReq({
        type: "recurring_billing.subscription_updated",
        data: { id: billingId, status: "closed" },
      }),
    );
    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
  });

  it("downgrades on failed status as well", async () => {
    const billingId = "rb_test_failed_over_cap";
    const wsId = await seedWorkspace({
      plan: "pro",
      hitpayRecurringBillingId: billingId,
      teamCount: 7,
    });
    const { POST } = await loadRoute();
    await POST(
      makeReq({
        type: "recurring_billing.subscription_updated",
        data: { id: billingId, status: "failed" },
      }),
    );
    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
  });
});

describe("hitpay webhook — paid-tier downgrade guard (Phase 2)", () => {
  it("still refuses a paid-tier downgrade (pro -> starter) when over the new cap", async () => {
    // 5 teams is over starter's 3-team cap. An active->active tier swap from
    // pro to starter must NOT silently drop teams — refuse the plan change,
    // owner must delete teams first.
    const billingId = "rb_test_tier_swap_over_cap";
    const wsId = await seedWorkspace({
      plan: "pro",
      hitpayRecurringBillingId: billingId,
      teamCount: 5,
    });
    const { POST } = await loadRoute();
    await POST(
      makeReq({
        type: "recurring_billing.subscription_updated",
        data: { id: billingId, status: "active", amount: 499 },
      }),
    );
    const after = await Workspace.findById(wsId).lean();
    // Plan must remain pro because the active->starter swap was refused.
    expect(after?.plan).toBe("pro");
    expect(after?.hitpayRecurringStatus).toBe("active");
  });
});

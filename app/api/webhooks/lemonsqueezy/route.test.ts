import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";

// ---------------------------------------------------------------------------
// Module mocks (declared before imports resolved via vi.mock hoisting)
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

// verifyAndParseLemonSqueezyEvent is mocked: each test configures the return
// value via the `mockResolvedValue` helper exposed below.
vi.mock("@/lib/lemonsqueezy/webhook", () => ({
  verifyAndParseLemonSqueezyEvent: vi.fn(),
}));

// Workflow API — we never want actual workflow runs in unit tests.
vi.mock("workflow/api", () => ({
  start: vi.fn().mockResolvedValue({ runId: "run_mock" }),
  resumeHook: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Env vars — must be set before the route module is imported so
// planForVariantId resolves correctly.
// ---------------------------------------------------------------------------
process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID = "1001";
process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID = "1002";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { verifyAndParseLemonSqueezyEvent } from "@/lib/lemonsqueezy/webhook";
import { resumeHook } from "workflow/api";

const mockVerify = vi.mocked(verifyAndParseLemonSqueezyEvent);
const mockResumeHook = vi.mocked(resumeHook);

function makeEvent(
  eventName: string,
  dataId: string,
  attributes: Record<string, unknown>,
  customData: Record<string, unknown> | null = null
) {
  return {
    meta: { event_name: eventName, custom_data: customData },
    data: { id: dataId, attributes },
  };
}

function makeSubscriptionAttrs(overrides: Record<string, unknown> = {}) {
  return {
    status: "active",
    customer_id: `${Math.floor(Math.random() * 1e6)}`,
    variant_id: process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID,
    renews_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

async function seedWorkspace(opts: {
  plan: "free" | "starter" | "pro";
  lsSubscriptionId?: string;
  lsCustomerId?: string;
  teamCount?: number;
}): Promise<Types.ObjectId> {
  const ws = await Workspace.create({
    ownerUserId: "user_owner",
    name: "Test WS",
    slug: `t-${Math.random().toString(36).slice(2, 8)}`,
    plan: opts.plan,
    lsSubscriptionId: opts.lsSubscriptionId ?? null,
    lsCustomerId: opts.lsCustomerId ?? null,
    lsSubscriptionStatus: null,
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    businessType: "photographer",
  });
  for (let i = 0; i < (opts.teamCount ?? 0); i++) {
    await Team.create({
      workspaceId: ws._id,
      name: `Team ${i + 1}`,
      color: TEAM_COLOR_PALETTE[i % TEAM_COLOR_PALETTE.length],
      isDefault: i === 0,
      memberCount: 0,
      createdByWorkosUserId: "user_owner",
    });
  }
  return ws._id;
}

function makeReq(body = "{}") {
  return new Request("http://test/api/webhooks/lemonsqueezy", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": "stub",
    },
    body,
  });
}

async function loadRoute() {
  return import("./route");
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await startInMemoryMongo();
}, 120_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("lemonsqueezy webhook — invalid signature", () => {
  it("returns 401 and writes nothing when verifyAndParseLemonSqueezyEvent returns null", async () => {
    mockVerify.mockResolvedValue(null);

    const wsId = await seedWorkspace({ plan: "free" });
    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid signature" });

    const ws = await Workspace.findById(wsId).lean();
    expect(ws?.plan).toBe("free");
    expect(ws?.lsSubscriptionId).toBeNull();
  });
});

describe("lemonsqueezy webhook — subscription_created", () => {
  it("sets plan to pro, status active, subscription id, and calls resumeHook", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    const subId = "sub_created_test";

    const event = makeEvent(
      "subscription_created",
      subId,
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsId.toString() }
    );

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody).toEqual({ received: true });

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionStatus).toBe("active");
    expect(after?.lsSubscriptionId).toBe(subId);
    expect(after?.lsCurrentPeriodEnd).toBeInstanceOf(Date);

    expect(mockResumeHook).toHaveBeenCalledOnce();
    expect(mockResumeHook).toHaveBeenCalledWith(
      `ls-checkout-${wsId.toString()}`,
      expect.objectContaining({
        subscriptionId: subId,
        status: "active",
      })
    );
  });

  it("resolves plan to pro when the variant is the yearly pro variant id", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    const subId = "sub_created_yearly";

    const event = makeEvent(
      "subscription_created",
      subId,
      makeSubscriptionAttrs({
        status: "active",
        variant_id: process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID,
      }),
      { workspaceId: wsId.toString() }
    );

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    expect(res.status).toBe(200);
    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionId).toBe(subId);
  });

  it("does NOT call resumeHook when custom_data.workspaceId is absent", async () => {
    const wsId = await seedWorkspace({ plan: "free", lsSubscriptionId: "sub_no_custom" });

    const event = makeEvent(
      "subscription_created",
      "sub_no_custom",
      makeSubscriptionAttrs(),
      null
    );

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    expect(mockResumeHook).not.toHaveBeenCalled();
    const after = await Workspace.findById(wsId).lean();
    expect(after?.lsSubscriptionStatus).toBe("active");
  });
});

describe("lemonsqueezy webhook — everSubscribed flag", () => {
  it("sets everSubscribed true on a paid promotion not blocked by the team-cap guard", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    const subId = "sub_ever_subscribed";

    const event = makeEvent(
      "subscription_created",
      subId,
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsId.toString() }
    );

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.everSubscribed).toBe(true);
  });

  it("keeps everSubscribed true after subscription_expired downgrades plan to free", async () => {
    const subId = "sub_ever_subscribed_then_expired";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });
    await Workspace.updateOne({ _id: wsId }, { $set: { everSubscribed: true } });

    const event = makeEvent("subscription_expired", subId, {
      status: "expired",
      customer_id: "ctm_1",
    });
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
    expect(after?.everSubscribed).toBe(true);
  });

  it("does NOT set everSubscribed when the team-cap guard refuses the promotion", async () => {
    const subId = "sub_ever_subscribed_blocked";
    const wsId = await seedWorkspace({
      plan: "free",
      lsSubscriptionId: subId,
      teamCount: 20,
    });

    const event = makeEvent(
      "subscription_updated",
      subId,
      makeSubscriptionAttrs({ status: "active" })
    );
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
    expect(after?.everSubscribed).toBe(false);
  });
});

describe("lemonsqueezy webhook — subscription_cancelled (does NOT downgrade)", () => {
  it("marks status canceled and keeps plan pro until expiry", async () => {
    const subId = "sub_cancel_test";
    const wsId = await seedWorkspace({
      plan: "pro",
      lsSubscriptionId: subId,
      teamCount: 5,
    });

    const event = makeEvent("subscription_cancelled", subId, {
      status: "cancelled",
      customer_id: "ctm_1",
      ends_at: "2026-08-01T00:00:00Z",
    });

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    // Plan stays pro — access continues until ends_at.
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionStatus).toBe("canceled");
    expect(after?.lsCurrentPeriodEnd).toBeInstanceOf(Date);
  });
});

describe("lemonsqueezy webhook — subscription_expired (downgrades)", () => {
  it("downgrades pro to free even when workspace has teams above the free cap", async () => {
    // 5 teams is above the free cap (1). Expiry must always downgrade.
    const subId = "sub_expired_over_cap";
    const wsId = await seedWorkspace({
      plan: "pro",
      lsSubscriptionId: subId,
      teamCount: 5,
    });

    const event = makeEvent("subscription_expired", subId, {
      status: "expired",
      customer_id: "ctm_1",
    });

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
    expect(after?.lsSubscriptionStatus).toBe("canceled");
    expect(after?.lsCurrentPeriodEnd).toBeNull();
  });

  it("downgrades starter to free even at the free team cap (2 teams > free's 1-team cap)", async () => {
    const subId = "sub_expired_starter";
    const wsId = await seedWorkspace({
      plan: "starter",
      lsSubscriptionId: subId,
      teamCount: 2,
    });

    const event = makeEvent("subscription_expired", subId, {
      status: "expired",
      customer_id: "ctm_2",
    });

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
  });

  it("a trailing subscription_updated with terminal status does not re-promote a workspace subscription_expired already downgraded", async () => {
    // subscription_updated fires on ANY attribute change and Lemon Squeezy's
    // event ordering isn't guaranteed — a subscription_updated carrying the
    // same terminal status can land after subscription_expired already ran.
    // variant_id is still populated on an expired event, so a naive upsert
    // would resolve it back to "pro" and silently undo the downgrade.
    const subId = "sub_trailing_update_after_expiry";
    const wsId = await seedWorkspace({
      plan: "pro",
      lsSubscriptionId: subId,
    });

    const expiredEvent = makeEvent("subscription_expired", subId, {
      status: "expired",
      customer_id: "ctm_1",
    });
    mockVerify.mockResolvedValue(expiredEvent as never);
    const { POST } = await loadRoute();
    await POST(makeReq());

    const afterExpiry = await Workspace.findById(wsId).lean();
    expect(afterExpiry?.plan).toBe("free");

    const trailingUpdate = makeEvent(
      "subscription_updated",
      subId,
      makeSubscriptionAttrs({ status: "expired" })
    );
    mockVerify.mockResolvedValue(trailingUpdate as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
  });

  it("clears lsSubscriptionId so a later resubscribe successfully promotes the plan", async () => {
    // Regression test: before the fix, expiry left the OLD subscription id on
    // the workspace. A later resubscribe's subscription_created (a new sub
    // id) would trip the mismatch guard in handleSubscriptionUpsert and
    // reroute to a filter matching zero documents, silently never promoting.
    const oldSubId = "sub_before_expiry";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: oldSubId });

    const expiredEvent = makeEvent("subscription_expired", oldSubId, {
      status: "expired",
      customer_id: "ctm_1",
    });
    mockVerify.mockResolvedValue(expiredEvent as never);
    const { POST } = await loadRoute();
    await POST(makeReq());

    const afterExpiry = await Workspace.findById(wsId).lean();
    expect(afterExpiry?.plan).toBe("free");
    expect(afterExpiry?.lsSubscriptionId).toBeNull();

    const newSubId = "sub_after_resubscribe";
    const resubscribeEvent = makeEvent(
      "subscription_created",
      newSubId,
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsId.toString() }
    );
    mockVerify.mockResolvedValue(resubscribeEvent as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionId).toBe(newSubId);
  });
});

describe("lemonsqueezy webhook — subscription_payment_refunded (downgrades)", () => {
  it("downgrades to free and clears lsSubscriptionId, same as expiry", async () => {
    const subId = "sub_refunded";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId, teamCount: 5 });

    // subscription-invoices resources: event.data.id is the invoice's own id
    // (distinct from the subscription id), and the real subscription id lives
    // in attributes.subscription_id.
    const event = makeEvent("subscription_payment_refunded", "inv_999", {
      subscription_id: subId,
      refunded: true,
      customer_id: "ctm_1",
    });

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
    expect(after?.lsSubscriptionStatus).toBe("canceled");
    expect(after?.lsCurrentPeriodEnd).toBeNull();
    expect(after?.lsSubscriptionId).toBeNull();
  });

  it("routes by custom_data.workspaceId when present, ignoring the invoice id", async () => {
    const subId = "sub_refunded_custom_data";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });

    const event = makeEvent(
      "subscription_payment_refunded",
      "inv_888",
      { subscription_id: subId, refunded: true },
      { workspaceId: wsId.toString() }
    );

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
  });
});

describe("lemonsqueezy webhook — team-cap guard on subscription_updated", () => {
  it("refuses promoting to pro when workspace exceeds pro's team cap", async () => {
    const subId = "sub_tier_swap_over_cap";
    const wsId = await seedWorkspace({
      plan: "free",
      lsSubscriptionId: subId,
      teamCount: 20,
    });

    const event = makeEvent(
      "subscription_updated",
      subId,
      makeSubscriptionAttrs({ status: "active" })
    );

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
    expect(after?.lsSubscriptionStatus).toBe("active");
    expect(after?.lsSubscriptionId).toBe(subId);
  });

  it("allows promoting to pro when workspace is within the team cap", async () => {
    const subId = "sub_tier_swap_allowed";
    const wsId = await seedWorkspace({
      plan: "free",
      lsSubscriptionId: subId,
      teamCount: 5,
    });

    const event = makeEvent(
      "subscription_updated",
      subId,
      makeSubscriptionAttrs({ status: "active" })
    );

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionStatus).toBe("active");
  });
});

describe("lemonsqueezy webhook — tenant isolation", () => {
  it("an event for workspace A does not modify workspace B", async () => {
    const subIdA = "sub_ws_a";
    const wsIdA = await seedWorkspace({ plan: "free", lsSubscriptionId: subIdA });
    const wsIdB = await seedWorkspace({ plan: "pro" });

    const event = makeEvent(
      "subscription_created",
      subIdA,
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsIdA.toString() }
    );

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const afterA = await Workspace.findById(wsIdA).lean();
    const afterB = await Workspace.findById(wsIdB).lean();

    expect(afterA?.plan).toBe("pro");
    expect(afterA?.lsSubscriptionId).toBe(subIdA);

    expect(afterB?.plan).toBe("pro");
    expect(afterB?.lsSubscriptionId).toBeNull();
    expect(afterB?.lsSubscriptionStatus).toBeNull();
  });
});

describe("lemonsqueezy webhook — subscription_payment_success", () => {
  it("bumps subscription status to active and updates period end when renews_at present", async () => {
    const subId = "sub_payment_success";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });
    await Workspace.updateOne({ _id: wsId }, { $set: { lsSubscriptionStatus: "past_due" } });

    const event = makeEvent("subscription_payment_success", subId, {
      renews_at: "2026-08-01T00:00:00Z",
    });

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.lsSubscriptionStatus).toBe("active");
    expect(after?.lsCurrentPeriodEnd).toBeInstanceOf(Date);
  });

  it("bumps status to active without touching periodEnd when renews_at is absent", async () => {
    const subId = "sub_payment_success_no_date";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });

    const event = makeEvent("subscription_payment_success", subId, {});
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const after = await Workspace.findById(wsId).lean();
    expect(after?.lsSubscriptionStatus).toBe("active");
    expect(after?.lsCurrentPeriodEnd).toBeNull();
  });
});

describe("lemonsqueezy webhook — subscription_paused and subscription_payment_failed", () => {
  it("updates status to paused without changing plan", async () => {
    const subId = "sub_paused";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });

    const event = makeEvent("subscription_paused", subId, { status: "paused" });
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionStatus).toBe("paused");
  });

  it("updates status to past_due on subscription_payment_failed without changing plan", async () => {
    const subId = "sub_payment_failed";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });

    const event = makeEvent("subscription_payment_failed", subId, { status: "past_due" });
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionStatus).toBe("past_due");
  });

  it("routes by custom_data.workspaceId even when lsSubscriptionId isn't persisted yet", async () => {
    // Lemon Squeezy doesn't guarantee event delivery order. If a status-only
    // event (e.g. subscription_paused) arrives before subscription_created's
    // DB write has landed, custom_data.workspaceId must still resolve the
    // right workspace — routing only by lsSubscriptionId/lsCustomerId would
    // match zero documents and silently drop the status update.
    const wsId = await seedWorkspace({ plan: "pro" }); // no lsSubscriptionId set yet

    const event = makeEvent(
      "subscription_paused",
      "sub_not_yet_persisted",
      { status: "paused", customer_id: "ctm_not_yet_persisted" },
      { workspaceId: wsId.toString() }
    );
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.lsSubscriptionStatus).toBe("paused");
  });
});

describe("lemonsqueezy webhook — malformed payload with no usable identifier", () => {
  it("no-ops instead of matching an unrelated workspace by a null filter value", async () => {
    // No custom_data.workspaceId, no subscription id, no customer_id — there
    // is nothing safe to route by. Must no-op, not fall through to a filter
    // like { lsCustomerId: null } that could match any never-billed workspace.
    const wsId = await seedWorkspace({ plan: "free" });

    const event = {
      meta: { event_name: "subscription_paused", custom_data: null },
      data: { id: "", attributes: { status: "paused" } },
    };
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
    expect(after?.lsSubscriptionStatus).toBeNull();
  });

  it("does not promote an unrelated workspace when subscription_created has no usable identifier", async () => {
    // handleSubscriptionUpsert builds its own filter separately from
    // resolveWorkspaceFilter — this exercises that its customer_id fallback
    // has the same "no-op instead of { lsCustomerId: null }" guard, since a
    // { lsCustomerId: null } filter would match (and could promote) any
    // never-billed workspace, not necessarily the one that actually paid.
    const victimWsId = await seedWorkspace({ plan: "free" });

    const event = makeEvent("subscription_created", "", {
      status: "active",
      variant_id: process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID,
    });
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(victimWsId).lean();
    expect(after?.plan).toBe("free");
    expect(after?.lsSubscriptionId).toBeNull();
  });
});

describe("lemonsqueezy webhook — customData.workspaceId mis-routing defence", () => {
  it("does NOT overwrite workspace B's subscription when custom_data.workspaceId points at B but B has a different active subscription", async () => {
    const subBExisting = "sub_b_existing";
    const wsIdB = await seedWorkspace({
      plan: "pro",
      lsSubscriptionId: subBExisting,
      lsCustomerId: "ctm_b",
    });

    const event = makeEvent(
      "subscription_created",
      "sub_new_different",
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsIdB.toString() }
    );

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsIdB).lean();
    expect(after?.lsSubscriptionId).toBe(subBExisting);
    expect(after?.plan).toBe("pro");
    expect(after?.lsCustomerId).toBe("ctm_b");
  });

  it("allows activation when custom_data.workspaceId points at a workspace with NO existing subscription", async () => {
    const wsId = await seedWorkspace({ plan: "free" });

    const event = makeEvent(
      "subscription_created",
      "sub_fresh_activation",
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsId.toString() }
    );

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.lsSubscriptionId).toBe("sub_fresh_activation");
    expect(after?.plan).toBe("pro");
  });

  it("allows activation when custom_data.workspaceId points at a workspace whose subscription id MATCHES the event (idempotent redelivery)", async () => {
    const subId = "sub_redelivered";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });

    const event = makeEvent(
      "subscription_created",
      subId,
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsId.toString() }
    );

    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.lsSubscriptionId).toBe(subId);
    expect(after?.plan).toBe("pro");
  });
});

describe("lemonsqueezy webhook — test-mode events in production", () => {
  it("ignores a test_mode event and writes nothing when NODE_ENV is production", async () => {
    const origEnv = process.env.NODE_ENV;
    // @ts-expect-error — NODE_ENV is read-only in the types but writable at runtime
    process.env.NODE_ENV = "production";

    try {
      const subId = "sub_test_mode";
      const wsId = await seedWorkspace({ plan: "free" });

      const event = {
        meta: {
          event_name: "subscription_created",
          custom_data: { workspaceId: wsId.toString() },
          test_mode: true,
        },
        data: { id: subId, attributes: makeSubscriptionAttrs({ status: "active" }) },
      };
      mockVerify.mockResolvedValue(event as never);

      const { POST } = await loadRoute();
      const res = await POST(makeReq());

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ received: true, ignored: "test_mode" });

      const after = await Workspace.findById(wsId).lean();
      expect(after?.plan).toBe("free");
      expect(after?.lsSubscriptionId).toBeNull();
    } finally {
      // @ts-expect-error — restore
      process.env.NODE_ENV = origEnv;
    }
  });

  it("still processes a test_mode event outside production", async () => {
    const subId = "sub_test_mode_dev";
    const wsId = await seedWorkspace({ plan: "free" });

    const event = {
      meta: {
        event_name: "subscription_created",
        custom_data: { workspaceId: wsId.toString() },
        test_mode: true,
      },
      data: { id: subId, attributes: makeSubscriptionAttrs({ status: "active" }) },
    };
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
  });
});

describe("lemonsqueezy webhook — handler exception acks 200 (never retries into a loop)", () => {
  it("acks 200 with an error flag instead of 500 when a handler throws unexpectedly", async () => {
    const subId = "sub_throws";
    await seedWorkspace({ plan: "free", lsSubscriptionId: subId });

    const spy = vi
      .spyOn(Team, "countDocuments")
      .mockRejectedValueOnce(new Error("db exploded") as never);

    const event = makeEvent(
      "subscription_updated",
      subId,
      makeSubscriptionAttrs({ status: "active" })
    );
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true, error: "handler failed" });

    spy.mockRestore();
  });
});

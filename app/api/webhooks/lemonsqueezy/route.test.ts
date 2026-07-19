import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace, WebhookEvent } from "@/lib/db/models";
import { Team, TEAM_COLOR_PALETTE } from "@/lib/db/models/team";

// ---------------------------------------------------------------------------
// Module mocks (declared before imports resolved via vi.mock hoisting)
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

// verifyAndParseLemonSqueezyEvent is mocked: each test configures the return
// value via the `mockResolvedValue` helper exposed below.
vi.mock("@/lib/lemonsqueezy/webhook", async () => {
  const actual = await vi.importActual<typeof import("@/lib/lemonsqueezy/webhook")>(
    "@/lib/lemonsqueezy/webhook"
  );
  return {
    ...actual,
    verifyAndParseLemonSqueezyEvent: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Env vars — must be set before the route module is imported so
// planForVariantId resolves correctly.
// ---------------------------------------------------------------------------
process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID = "1001";
process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID = "1002";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { verifyAndParseLemonSqueezyEvent, computeWebhookEventKey } from "@/lib/lemonsqueezy/webhook";

const mockVerify = vi.mocked(verifyAndParseLemonSqueezyEvent);

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
  plan: "free" | "pro";
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

describe("lemonsqueezy webhook — event ledger", () => {
  it("records a WebhookEvent row with status processed after a successful handler run", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    const subId = "sub_ledger_test";

    const event = makeEvent(
      "subscription_created",
      subId,
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsId.toString() }
    );
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const rows = await WebhookEvent.find({}).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].eventName).toBe("subscription_created");
    expect(rows[0].status).toBe("processed");
    expect(rows[0].processedAt).toBeInstanceOf(Date);
  });

  it("dedupes an identical redelivered event — single WebhookEvent row, ack carries deduped:true", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    const subId = "sub_dedupe_test";

    const event = makeEvent(
      "subscription_created",
      subId,
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsId.toString() }
    );
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const first = await POST(makeReq());
    expect((await first.json()).deduped).toBeUndefined();

    const second = await POST(makeReq());
    const secondBody = await second.json();
    expect(secondBody).toEqual({ received: true, deduped: true });

    const rows = await WebhookEvent.find({}).lean();
    expect(rows).toHaveLength(1);
  });

  it("dedupes a redelivered subscription_payment_recovered event", async () => {
    const subId = "sub_dedupe_payment_recovered";
    await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });

    const event = makeEvent("subscription_payment_recovered", subId, {
      renews_at: "2026-08-01T00:00:00Z",
    });
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const first = await POST(makeReq());
    expect((await first.json()).deduped).toBeUndefined();

    const second = await POST(makeReq());
    expect(await second.json()).toEqual({ received: true, deduped: true });

    const rows = await WebhookEvent.find({ eventName: "subscription_payment_recovered" }).lean();
    expect(rows).toHaveLength(1);
  });

  it("dedupes a redelivered subscription_plan_changed event", async () => {
    const subId = "sub_dedupe_plan_changed";
    await seedWorkspace({ plan: "free", lsSubscriptionId: subId, teamCount: 5 });

    const event = makeEvent(
      "subscription_plan_changed",
      subId,
      makeSubscriptionAttrs({ status: "active" })
    );
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const first = await POST(makeReq());
    expect((await first.json()).deduped).toBeUndefined();

    const second = await POST(makeReq());
    expect(await second.json()).toEqual({ received: true, deduped: true });

    const rows = await WebhookEvent.find({ eventName: "subscription_plan_changed" }).lean();
    expect(rows).toHaveLength(1);
  });

  it("processes two REAL concurrent identical deliveries with exactly one handler execution", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    const subId = "sub_real_concurrent";
    const event = makeEvent(
      "subscription_created",
      subId,
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsId.toString() }
    );
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const [resA, resB] = await Promise.all([POST(makeReq()), POST(makeReq())]);
    const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);

    const outcomes = [bodyA, bodyB];
    const freshCount = outcomes.filter(
      (b) => b.received === true && !b.deduped && !b.processing
    ).length;
    expect(freshCount).toBe(1);

    const rows = await WebhookEvent.find({}).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("processed");

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionId).toBe(subId);
  });

  it("recovers from a concurrent duplicate-key upsert against a live claim instead of 500ing", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    const subId = "sub_concurrent_dup";
    const event = makeEvent(
      "subscription_created",
      subId,
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsId.toString() }
    );
    mockVerify.mockResolvedValue(event as never);

    const eventKey = computeWebhookEventKey(event as never);
    // Simulate a concurrent first delivery that already won the claim (the
    // row now exists, status "processing", live lease) before this request's
    // own upsert attempt runs.
    await WebhookEvent.create({
      provider: "lemonsqueezy",
      eventKey,
      eventName: event.meta.event_name,
      resourceId: event.data.id,
      status: "processing",
      claimToken: "concurrent-winner-token",
      claimedAt: new Date(),
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    const findOneAndUpdateSpy = vi
      .spyOn(WebhookEvent, "findOneAndUpdate")
      .mockRejectedValueOnce(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }));

    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true, processing: true });
    findOneAndUpdateSpy.mockRestore();

    const rows = await WebhookEvent.find({ eventKey }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("processing");
    expect(rows[0].claimToken).toBe("concurrent-winner-token");
  });
});

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

describe("lemonsqueezy webhook — misconfigured secret", () => {
  it("returns a retryable 500 instead of an uncaught exception when verification throws", async () => {
    mockVerify.mockRejectedValue(new Error("Missing env var LEMONSQUEEZY_WEBHOOK_SECRET"));

    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "webhook_verification_failed" });
  });
});

describe("lemonsqueezy webhook — malformed verified payload", () => {
  it("returns 400 and writes nothing when the verified body doesn't match the envelope shape", async () => {
    mockVerify.mockResolvedValue({ meta: {}, data: {} } as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "invalid_payload" });
    expect(await WebhookEvent.countDocuments({})).toBe(0);
  });
});

describe("lemonsqueezy webhook — unsupported (unmodelled) event", () => {
  it("returns 200 and performs no billing mutation for an event name outside the 12-event registry", async () => {
    const wsId = await seedWorkspace({ plan: "free" });

    const event = makeEvent(
      "order_created",
      "order_1",
      { status: "paid" },
      { workspaceId: wsId.toString() }
    );
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true });

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
    expect(after?.lsSubscriptionId).toBeNull();

    const rows = await WebhookEvent.find({}).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("processed");
  });
});

describe("lemonsqueezy webhook — subscription_created", () => {
  it("sets plan to pro, status active, subscription id", async () => {
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

  it("applies the same status/subscription-id update when custom_data.workspaceId is absent", async () => {
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

  it("grants a ~15-day planGrantExpiresAt buffer on expiry, even if the workspace already had everSubscribed", async () => {
    const subId = "sub_expired_grant_buffer";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });
    await Workspace.updateOne(
      { _id: wsId },
      { $set: { everSubscribed: true, planGrantExpiresAt: new Date(Date.now() - 1000) } }
    );

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
    expect(after?.planGrantExpiresAt).toBeInstanceOf(Date);
    const days =
      (after!.planGrantExpiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(14);
    expect(days).toBeLessThan(16);
  });

  it("downgrades pro to free even at the free team cap (2 teams > free's 1-team cap)", async () => {
    const subId = "sub_expired_pro";
    const wsId = await seedWorkspace({
      plan: "pro",
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

describe("lemonsqueezy webhook — subscription_expired with a queued promo grant", () => {
  it("applies the queued grant instead of downgrading to free (no false-gated tick)", async () => {
    const subId = "sub_expired_with_pending_grant";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });
    await Workspace.updateOne(
      { _id: wsId },
      {
        $set: {
          "pendingPromoGrant.grantMonths": 2,
          "pendingPromoGrant.queuedAt": new Date(),
        },
      }
    );

    const event = makeEvent("subscription_expired", subId, {
      status: "expired",
      customer_id: "ctm_1",
    });
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionId).toBeNull();
    expect(after?.planGrantExpiresAt).toBeInstanceOf(Date);
    expect(after?.pendingPromoGrant?.grantMonths).toBeNull();
    expect(after?.pendingPromoGrant?.queuedAt).toBeNull();
  });
});

describe("lemonsqueezy webhook — subscription_expired never touches a workspace with no matching lsSubscriptionId", () => {
  it("no-ops for a beta/promo-granted workspace (lsSubscriptionId null) when the event carries no custom_data.workspaceId", async () => {
    // beta/promo-granted workspaces (planGrantExpiresAt-based) never have an
    // lsSubscriptionId — a stray/replayed subscription_expired event for some
    // unrelated Lemon Squeezy subscription id must not touch them.
    const wsId = await seedWorkspace({ plan: "beta" as never, teamCount: 0 });

    const event = makeEvent("subscription_expired", "sub_unrelated_to_beta_ws", {
      status: "expired",
      customer_id: "ctm_unrelated",
    });
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("beta");
    expect(after?.lsSubscriptionId).toBeNull();
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

describe("lemonsqueezy webhook — subscription_plan_changed", () => {
  it("routes through the same upsert handler as subscription_updated (plan resolution + team-cap guard wiring)", async () => {
    const subId = "sub_plan_changed";
    const wsId = await seedWorkspace({
      plan: "free",
      lsSubscriptionId: subId,
      teamCount: 5,
    });

    const event = makeEvent(
      "subscription_plan_changed",
      subId,
      makeSubscriptionAttrs({ status: "active" })
    );
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

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

describe("lemonsqueezy webhook — subscription_payment_recovered", () => {
  it("bumps subscription status to active and resets lifecycle fields (same handling as payment_success)", async () => {
    const subId = "sub_payment_recovered";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });
    await Workspace.updateOne(
      { _id: wsId },
      { $set: { lsSubscriptionStatus: "past_due", "lifecycle.lapsedAt": new Date() } }
    );

    const event = makeEvent("subscription_payment_recovered", subId, {
      renews_at: "2026-08-01T00:00:00Z",
    });
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.lsSubscriptionStatus).toBe("active");
    expect(after?.lsCurrentPeriodEnd).toBeInstanceOf(Date);
    expect(after?.lifecycle?.lapsedAt).toBeNull();
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

describe("lemonsqueezy webhook — lifecycle field mapping", () => {
  it("does NOT stamp lifecycle.lapsedAt on subscription_expired (the lazy grant-expiry path stamps it once the 15-day buffer lapses)", async () => {
    const subId = "sub_expired_lapse_stamp";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });

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
    expect(after?.lifecycle?.lapsedAt).toBeNull();
    expect(after?.planGrantExpiresAt).toBeInstanceOf(Date);
  });

  it("resets lifecycle.* to null on subscription_resumed", async () => {
    const subId = "sub_resumed_lifecycle";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });
    await Workspace.updateOne(
      { _id: wsId },
      { $set: { "lifecycle.lapsedAt": new Date(), "lifecycle.remind1moAt": new Date() } }
    );

    const event = makeEvent("subscription_resumed", subId, { status: "active" });
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.lifecycle?.lapsedAt).toBeNull();
    expect(after?.lifecycle?.remind1moAt).toBeNull();
  });

  it("does NOT reset lifecycle.* on subscription_paused (still entitled)", async () => {
    const subId = "sub_paused_lifecycle";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });
    const marker = new Date();
    await Workspace.updateOne({ _id: wsId }, { $set: { "lifecycle.remind1moAt": marker } });

    const event = makeEvent("subscription_paused", subId, { status: "paused" });
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const after = await Workspace.findById(wsId).lean();
    expect(after?.lifecycle?.remind1moAt?.getTime()).toBe(marker.getTime());
  });

  it("resets lifecycle.* to null on subscription_payment_success", async () => {
    const subId = "sub_payment_success_lifecycle";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });
    await Workspace.updateOne({ _id: wsId }, { $set: { "lifecycle.lapsedAt": new Date() } });

    const event = makeEvent("subscription_payment_success", subId, {
      renews_at: "2026-08-01T00:00:00Z",
    });
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const after = await Workspace.findById(wsId).lean();
    expect(after?.lifecycle?.lapsedAt).toBeNull();
  });

  it("resets lifecycle.* to null on subscription_created (active)", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    await Workspace.updateOne(
      { _id: wsId },
      {
        $set: {
          "lifecycle.lapsedAt": new Date(),
          "lifecycle.warned7dAt": new Date(),
          "lifecycle.expiredNotifiedAt": new Date(),
          "lifecycle.remind1moAt": new Date(),
          "lifecycle.remind7wkAt": new Date(),
          "lifecycle.wipedAt": new Date(),
        },
      }
    );

    const subId = "sub_lifecycle_reset";
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
    expect(after?.lifecycle?.lapsedAt).toBeNull();
    expect(after?.lifecycle?.warned7dAt).toBeNull();
    expect(after?.lifecycle?.expiredNotifiedAt).toBeNull();
    expect(after?.lifecycle?.remind1moAt).toBeNull();
    expect(after?.lifecycle?.remind7wkAt).toBeNull();
    expect(after?.lifecycle?.wipedAt).toBeNull();
  });
});

describe("lemonsqueezy webhook — handler exception returns a retryable 5xx", () => {
  it("returns 500 (not 200) and marks the ledger row failed when a handler throws unexpectedly", async () => {
    const subId = "sub_throws_retryable";
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

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ received: false, error: "handler failed" });

    const rows = await WebhookEvent.find({}).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("failed");
    expect(rows[0].failedAt).toBeInstanceOf(Date);
    expect(rows[0].lastError).toContain("db exploded");

    spy.mockRestore();
  });

  it("truncates a long handler error message to 500 characters before storing it", async () => {
    const subId = "sub_throws_long_error";
    await seedWorkspace({ plan: "free", lsSubscriptionId: subId });

    const spy = vi
      .spyOn(Team, "countDocuments")
      .mockRejectedValueOnce(new Error(`db exploded ${"x".repeat(600)}`) as never);

    const event = makeEvent(
      "subscription_updated",
      subId,
      makeSubscriptionAttrs({ status: "active" })
    );
    mockVerify.mockResolvedValue(event as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(500);

    const rows = await WebhookEvent.find({}).lean();
    expect(rows[0].lastError!.length).toBeLessThanOrEqual(500);

    spy.mockRestore();
  });
});

describe("lemonsqueezy webhook — claim lease (expired-lease reclaim)", () => {
  it("reclaims a row whose lease has expired even though status is still 'processing'", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    const subId = "sub_expired_lease_reclaim";
    const event = makeEvent(
      "subscription_created",
      subId,
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsId.toString() }
    );
    mockVerify.mockResolvedValue(event as never);
    const eventKey = computeWebhookEventKey(event as never);

    await WebhookEvent.create({
      provider: "lemonsqueezy",
      eventKey,
      eventName: event.meta.event_name,
      resourceId: event.data.id,
      status: "processing",
      claimToken: "stale-worker-token",
      claimedAt: new Date(Date.now() - 3 * 60_000),
      leaseExpiresAt: new Date(Date.now() - 60_000),
    });

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true });

    const rows = await WebhookEvent.find({ eventKey }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("processed");
    expect(rows[0].claimToken).not.toBe("stale-worker-token");

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
  });

  it("reclaims and retries a row with status 'failed' regardless of its lease", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    const subId = "sub_failed_retry";
    const event = makeEvent(
      "subscription_created",
      subId,
      makeSubscriptionAttrs({ status: "active" }),
      { workspaceId: wsId.toString() }
    );
    mockVerify.mockResolvedValue(event as never);
    const eventKey = computeWebhookEventKey(event as never);

    await WebhookEvent.create({
      provider: "lemonsqueezy",
      eventKey,
      eventName: event.meta.event_name,
      resourceId: event.data.id,
      status: "failed",
      claimToken: "old-failed-token",
      claimedAt: new Date(),
      leaseExpiresAt: new Date(Date.now() + 60_000), // still "live" but failed is always reclaimable
      lastError: "previous attempt exploded",
    });

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const rows = await WebhookEvent.find({ eventKey }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("processed");
    expect(rows[0].attemptCount).toBe(2);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
  });

  it("does not let a stale (expired-lease, since-reclaimed) worker's completion overwrite a newer claimant's row", async () => {
    // Simulates worker A's lease already expired and worker B reclaiming the
    // row (different claimToken, live lease) before A's completion write
    // lands. A's write must no-op, not clobber B's claim/result.
    const ledger = await WebhookEvent.create({
      provider: "lemonsqueezy",
      eventKey: "hash_stale_claim_test",
      eventName: "subscription_created",
      resourceId: "sub_stale_claim",
      status: "processing",
      claimToken: "worker-b-token",
      claimedAt: new Date(),
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });

    await WebhookEvent.updateOne(
      { _id: ledger._id, claimToken: "worker-a-token-already-expired" },
      { $set: { status: "processed", processedAt: new Date() } }
    );

    const after = await WebhookEvent.findById(ledger._id).lean();
    expect(after?.status).toBe("processing");
    expect(after?.claimToken).toBe("worker-b-token");
  });
});

describe("lemonsqueezy webhook — out-of-order event ordering", () => {
  it("a delayed OLDER active update cannot restore access after a newer expiry already processed", async () => {
    const subId = "sub_ordering_old_active_after_expiry";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });

    const newerExpired = makeEvent("subscription_expired", subId, {
      status: "expired",
      customer_id: "ctm_1",
      updated_at: "2026-08-10T00:00:00Z",
    });
    mockVerify.mockResolvedValue(newerExpired as never);
    const { POST } = await loadRoute();
    await POST(makeReq());

    const afterExpiry = await Workspace.findById(wsId).lean();
    expect(afterExpiry?.plan).toBe("free");

    // A delayed, OLDER active update for the same subscription arrives after
    // the newer expiry already processed — route by customer_id since
    // lsSubscriptionId was cleared by the expiry.
    const olderActive = makeEvent(
      "subscription_updated",
      subId,
      makeSubscriptionAttrs({
        status: "active",
        customer_id: "ctm_1",
        updated_at: "2026-08-01T00:00:00Z",
      })
    );
    mockVerify.mockResolvedValue(olderActive as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
  });

  it("a genuinely newer resubscription activates Pro after an older processed expiry", async () => {
    const subId = "sub_ordering_newer_resub";
    const wsId = await seedWorkspace({ plan: "pro", lsSubscriptionId: subId });

    const olderExpired = makeEvent("subscription_expired", subId, {
      status: "expired",
      customer_id: "ctm_1",
      updated_at: "2026-08-01T00:00:00Z",
    });
    mockVerify.mockResolvedValue(olderExpired as never);
    const { POST } = await loadRoute();
    await POST(makeReq());

    const afterExpiry = await Workspace.findById(wsId).lean();
    expect(afterExpiry?.plan).toBe("free");

    const newSubId = "sub_ordering_newer_resub_2";
    const newerResub = makeEvent(
      "subscription_created",
      newSubId,
      makeSubscriptionAttrs({ status: "active", updated_at: "2026-08-15T00:00:00Z" }),
      { workspaceId: wsId.toString() }
    );
    mockVerify.mockResolvedValue(newerResub as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionId).toBe(newSubId);
  });
});

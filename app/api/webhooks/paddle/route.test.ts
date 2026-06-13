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

// verifyAndParsePaddleEvent is mocked: each test configures the return value
// via the `mockReturnValue` / `mockResolvedValue` helpers exposed below.
vi.mock("@/lib/paddle/webhook", () => ({
  verifyAndParsePaddleEvent: vi.fn(),
}));

// Workflow API — we never want actual workflow runs in unit tests.
vi.mock("workflow/api", () => ({
  start: vi.fn().mockResolvedValue({ runId: "run_mock" }),
  resumeHook: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Env vars — must be set before the route module is imported so planForPriceId
// resolves correctly.
// ---------------------------------------------------------------------------
process.env.PADDLE_PRICE_STARTER_ID = "pri_test_starter";
process.env.PADDLE_PRICE_PRO_ID = "pri_test_pro";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { verifyAndParsePaddleEvent } from "@/lib/paddle/webhook";
import { resumeHook } from "workflow/api";
import { EventName } from "@paddle/paddle-node-sdk";

const mockVerify = vi.mocked(verifyAndParsePaddleEvent);
const mockResumeHook = vi.mocked(resumeHook);

// Build a minimal Paddle-style event object that satisfies the route's
// runtime access pattern. We only set the fields the handler actually reads.
function makeEvent(
  eventType: string,
  data: Record<string, unknown>
) {
  return { eventType, data };
}

function makeSubscriptionData(overrides: Record<string, unknown> = {}) {
  return {
    id: `sub_${Math.random().toString(36).slice(2, 10)}`,
    status: "active",
    customerId: `ctm_${Math.random().toString(36).slice(2, 10)}`,
    currentBillingPeriod: { startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-07-01T00:00:00Z" },
    items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_ID } }],
    customData: null,
    ...overrides,
  };
}

function makeTransactionData(overrides: Record<string, unknown> = {}) {
  return {
    id: `txn_${Math.random().toString(36).slice(2, 10)}`,
    status: "completed",
    customerId: `ctm_${Math.random().toString(36).slice(2, 10)}`,
    subscriptionId: null,
    billingPeriod: null,
    ...overrides,
  };
}

async function seedWorkspace(opts: {
  plan: "free" | "starter" | "pro";
  paddleSubscriptionId?: string;
  paddleCustomerId?: string;
  teamCount?: number;
}): Promise<Types.ObjectId> {
  const ws = await Workspace.create({
    ownerUserId: "user_owner",
    name: "Test WS",
    slug: `t-${Math.random().toString(36).slice(2, 8)}`,
    plan: opts.plan,
    paddleSubscriptionId: opts.paddleSubscriptionId ?? null,
    paddleCustomerId: opts.paddleCustomerId ?? null,
    paddleSubscriptionStatus: null,
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
  return new Request("http://test/api/webhooks/paddle", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "paddle-signature": "stub",
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

describe("paddle webhook — invalid signature", () => {
  it("returns 401 and writes nothing when verifyAndParsePaddleEvent returns null", async () => {
    mockVerify.mockResolvedValue(null);

    const wsId = await seedWorkspace({ plan: "free" });
    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid signature" });

    const ws = await Workspace.findById(wsId).lean();
    expect(ws?.plan).toBe("free");
    expect(ws?.paddleSubscriptionId).toBeNull();
  });
});

describe("paddle webhook — subscription.activated", () => {
  it("sets plan to starter, status active, subscription id, and calls resumeHook", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    const subId = "sub_activated_test";

    const data = makeSubscriptionData({
      id: subId,
      status: "active",
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_ID } }],
      customData: { workspaceId: wsId.toString() },
    });

    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionActivated, data) as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody).toEqual({ received: true });

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("starter");
    expect(after?.paddleSubscriptionStatus).toBe("active");
    expect(after?.paddleSubscriptionId).toBe(subId);
    expect(after?.paddleCurrentPeriodEnd).toBeInstanceOf(Date);

    expect(mockResumeHook).toHaveBeenCalledOnce();
    expect(mockResumeHook).toHaveBeenCalledWith(
      `paddle-checkout-${wsId.toString()}`,
      expect.objectContaining({
        subscriptionId: subId,
        status: "active",
      })
    );
  });

  it("does NOT call resumeHook when customData.workspaceId is absent", async () => {
    const wsId = await seedWorkspace({ plan: "free", paddleSubscriptionId: "sub_no_custom" });

    const data = makeSubscriptionData({
      id: "sub_no_custom",
      customData: null,
    });

    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionActivated, data) as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    expect(mockResumeHook).not.toHaveBeenCalled();
    const after = await Workspace.findById(wsId).lean();
    expect(after?.paddleSubscriptionStatus).toBe("active");
  });
});

describe("paddle webhook — subscription.canceled", () => {
  it("downgrades pro to free even when workspace has teams above the free cap", async () => {
    // 5 teams is above the free cap (1). Cancellations must always downgrade.
    const subId = "sub_cancel_over_cap";
    const wsId = await seedWorkspace({
      plan: "pro",
      paddleSubscriptionId: subId,
      teamCount: 5,
    });

    const data = makeSubscriptionData({
      id: subId,
      status: "canceled",
      items: [],
      customData: null,
    });

    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionCanceled, data) as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
    expect(after?.paddleSubscriptionStatus).toBe("canceled");
    expect(after?.paddleCurrentPeriodEnd).toBeNull();
  });

  it("downgrades starter to free even when at the free team cap with 2 teams", async () => {
    const subId = "sub_cancel_starter";
    const wsId = await seedWorkspace({
      plan: "starter",
      paddleSubscriptionId: subId,
      teamCount: 2,
    });

    const data = makeSubscriptionData({ id: subId, status: "canceled", customData: null });
    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionCanceled, data) as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
    expect(after?.paddleSubscriptionStatus).toBe("canceled");
  });
});

describe("paddle webhook — team-cap guard on subscription.updated", () => {
  it("refuses a pro→starter downgrade when workspace exceeds starter's team cap", async () => {
    // starter allows 3 teams; workspace has 5 — plan must stay pro.
    const subId = "sub_tier_swap_over_cap";
    const wsId = await seedWorkspace({
      plan: "pro",
      paddleSubscriptionId: subId,
      teamCount: 5,
    });

    const data = makeSubscriptionData({
      id: subId,
      status: "active",
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_ID } }],
      customData: null,
    });

    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionUpdated, data) as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    // Plan is unchanged — the swap was refused.
    expect(after?.plan).toBe("pro");
    // Other fields are still updated.
    expect(after?.paddleSubscriptionStatus).toBe("active");
    expect(after?.paddleSubscriptionId).toBe(subId);
  });

  it("allows a pro→starter downgrade when workspace is within the team cap", async () => {
    const subId = "sub_tier_swap_allowed";
    const wsId = await seedWorkspace({
      plan: "pro",
      paddleSubscriptionId: subId,
      teamCount: 2, // starter allows 3
    });

    const data = makeSubscriptionData({
      id: subId,
      status: "active",
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_ID } }],
      customData: null,
    });

    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionUpdated, data) as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("starter");
    expect(after?.paddleSubscriptionStatus).toBe("active");
  });
});

describe("paddle webhook — tenant isolation", () => {
  it("an event for workspace A does not modify workspace B", async () => {
    const subIdA = "sub_ws_a";
    const wsIdA = await seedWorkspace({ plan: "free", paddleSubscriptionId: subIdA });
    const wsIdB = await seedWorkspace({ plan: "pro" });

    const data = makeSubscriptionData({
      id: subIdA,
      status: "active",
      items: [{ price: { id: process.env.PADDLE_PRICE_PRO_ID } }],
      customData: { workspaceId: wsIdA.toString() },
    });

    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionActivated, data) as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const afterA = await Workspace.findById(wsIdA).lean();
    const afterB = await Workspace.findById(wsIdB).lean();

    expect(afterA?.plan).toBe("pro");
    expect(afterA?.paddleSubscriptionId).toBe(subIdA);

    // Workspace B must be untouched.
    expect(afterB?.plan).toBe("pro");
    expect(afterB?.paddleSubscriptionId).toBeNull();
    expect(afterB?.paddleSubscriptionStatus).toBeNull();
  });
});

describe("paddle webhook — transaction.completed", () => {
  it("bumps subscription status to active and updates period end", async () => {
    const subId = "sub_txn_complete";
    const wsId = await seedWorkspace({
      plan: "starter",
      paddleSubscriptionId: subId,
    });

    await Workspace.updateOne({ _id: wsId }, { $set: { paddleSubscriptionStatus: "past_due" } });

    const data = makeTransactionData({
      subscriptionId: subId,
      billingPeriod: { startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-08-01T00:00:00Z" },
    });

    mockVerify.mockResolvedValue(makeEvent(EventName.TransactionCompleted, data) as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.paddleSubscriptionStatus).toBe("active");
    expect(after?.paddleCurrentPeriodEnd).toBeInstanceOf(Date);
  });

  it("is a no-op when the transaction is not linked to a subscription", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    const data = makeTransactionData({ subscriptionId: null });

    mockVerify.mockResolvedValue(makeEvent(EventName.TransactionCompleted, data) as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("free");
    expect(after?.paddleSubscriptionStatus).toBeNull();
  });
});

describe("paddle webhook — subscription.past_due and subscription.paused", () => {
  it("updates status to past_due without changing plan", async () => {
    const subId = "sub_past_due";
    const wsId = await seedWorkspace({ plan: "pro", paddleSubscriptionId: subId });

    const data = makeSubscriptionData({ id: subId, status: "past_due", customData: null });
    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionPastDue, data) as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.paddleSubscriptionStatus).toBe("past_due");
  });

  it("updates status to paused without changing plan", async () => {
    const subId = "sub_paused";
    const wsId = await seedWorkspace({ plan: "starter", paddleSubscriptionId: subId });

    const data = makeSubscriptionData({ id: subId, status: "paused", customData: null });
    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionPaused, data) as never);

    const { POST } = await loadRoute();
    await POST(makeReq());

    const after = await Workspace.findById(wsId).lean();
    expect(after?.plan).toBe("starter");
    expect(after?.paddleSubscriptionStatus).toBe("paused");
  });
});

describe("paddle webhook — customData.workspaceId mis-routing defence", () => {
  it("does NOT overwrite workspace B's subscription when customData.workspaceId points at B but B has a different active subscription", async () => {
    // Workspace B already has an active subscription (sub_b_existing).
    // The incoming event carries customData.workspaceId = B but data.id = sub_new.
    // The webhook must detect the mismatch and NOT overwrite B's subscription.
    const subBExisting = "sub_b_existing";
    const wsIdB = await seedWorkspace({
      plan: "starter",
      paddleSubscriptionId: subBExisting,
      paddleCustomerId: "ctm_b",
    });

    const data = makeSubscriptionData({
      id: "sub_new_different",
      status: "active",
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_ID } }],
      customData: { workspaceId: wsIdB.toString() },
    });

    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionActivated, data) as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    // Workspace B must retain its original subscription — not be overwritten.
    const after = await Workspace.findById(wsIdB).lean();
    expect(after?.paddleSubscriptionId).toBe(subBExisting);
    // plan and customerId must also be unchanged
    expect(after?.plan).toBe("starter");
    expect(after?.paddleCustomerId).toBe("ctm_b");
  });

  it("allows activation when customData.workspaceId points at a workspace with NO existing subscription", async () => {
    const wsId = await seedWorkspace({ plan: "free" });

    const data = makeSubscriptionData({
      id: "sub_fresh_activation",
      status: "active",
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_ID } }],
      customData: { workspaceId: wsId.toString() },
    });

    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionActivated, data) as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.paddleSubscriptionId).toBe("sub_fresh_activation");
    expect(after?.plan).toBe("starter");
  });

  it("allows activation when customData.workspaceId points at a workspace whose subscription id MATCHES the event", async () => {
    // Same subscription id already recorded (re-delivery scenario).
    const subId = "sub_redelivery";
    const wsId = await seedWorkspace({
      plan: "free",
      paddleSubscriptionId: subId,
    });

    const data = makeSubscriptionData({
      id: subId,
      status: "active",
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_ID } }],
      customData: { workspaceId: wsId.toString() },
    });

    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionActivated, data) as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const after = await Workspace.findById(wsId).lean();
    expect(after?.paddleSubscriptionId).toBe(subId);
    expect(after?.plan).toBe("starter");
  });
});

describe("paddle webhook — handler exception returns 500", () => {
  it("returns 500 so Paddle retries when a handler throws unexpectedly", async () => {
    const subId = "sub_throws";
    await seedWorkspace({ plan: "free", paddleSubscriptionId: subId });

    // Force an internal error: make Team.countDocuments throw.
    const origCountDocs = Team.countDocuments.bind(Team);
    const spy = vi
      .spyOn(Team, "countDocuments")
      .mockRejectedValueOnce(new Error("db exploded") as never);

    const data = makeSubscriptionData({
      id: subId,
      status: "active",
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_ID } }],
      customData: null,
    });
    mockVerify.mockResolvedValue(makeEvent(EventName.SubscriptionUpdated, data) as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "handler failed" });

    spy.mockRestore();
    void origCountDocs;
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";
import { __resetRateLimitForTests } from "@/lib/server/rateLimit";

// ---------------------------------------------------------------------------
// Env — read at module-eval time by lib/lemonsqueezy/plans.ts, so set before import.
// ---------------------------------------------------------------------------
process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID = "1001";
process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID = "1002";

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: vi.fn(),
}));

vi.mock("@/lib/lemonsqueezy/client", () => ({
  createSubscriptionCheckout: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn(),
}));

// Workflow runtime — never spin real runs in unit tests.
vi.mock("workflow/api", () => ({
  start: vi.fn(),
  getHookByToken: vi.fn(),
  getRun: vi.fn(),
}));

import { requireOrg } from "@/lib/auth/requireOrg";
import { createSubscriptionCheckout } from "@/lib/lemonsqueezy/client";
import { getAuthUser } from "@/lib/auth/session";
import { start, getHookByToken, getRun } from "workflow/api";

const mockRequireOrg = vi.mocked(requireOrg);
const mockCreateCheckout = vi.mocked(createSubscriptionCheckout);
const mockGetAuthUser = vi.mocked(getAuthUser);
const mockStart = vi.mocked(start);
const mockGetHookByToken = vi.mocked(getHookByToken);
const mockGetRun = vi.mocked(getRun);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedWorkspace(opts: {
  plan?: "free" | "starter" | "pro";
  lsCheckoutWorkflowRunId?: string | null;
} = {}): Promise<Types.ObjectId> {
  const ws = await Workspace.create({
    clerkOrgId: `org_${Math.random().toString(36).slice(2, 10)}`,
    ownerUserId: "user_owner",
    name: "Test WS",
    slug: `t-${Math.random().toString(36).slice(2, 8)}`,
    plan: opts.plan ?? "free",
    lsCheckoutWorkflowRunId: opts.lsCheckoutWorkflowRunId ?? null,
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    businessType: "photographer",
  });
  return ws._id;
}

function wireAuth(wsId: Types.ObjectId) {
  mockRequireOrg.mockResolvedValue({
    workspace: {
      _id: wsId,
      name: "Test WS",
    },
  } as never);

  mockGetAuthUser.mockResolvedValue({
    workosUserId: "wos_user_owner",
    email: "owner@example.com",
    name: "Owner Person",
    avatarUrl: null,
  });
}

function makeReq(body: unknown = { plan: "starter" }) {
  return new Request("http://test/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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
  __resetRateLimitForTests();

  mockCreateCheckout.mockResolvedValue("https://checkout.lemonsqueezy.com/buy/abc123");
  mockStart.mockResolvedValue({ runId: "run_new" } as never);
  // Default: no hook in flight (common path).
  mockGetHookByToken.mockRejectedValue(new Error("HookNotFound"));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("billing checkout — validation", () => {
  it("rejects an invalid plan with 400", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "enterprise" }));

    expect(res.status).toBe(400);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("rejects the merged-away 'starter' plan as invalid_request", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "starter" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "invalid_request" });
    expect(mockStart).not.toHaveBeenCalled();
  });
});

describe("billing checkout — happy path (no stale run)", () => {
  it("starts a workflow, persists the run id, and returns the checkout url", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      checkoutUrl: "https://checkout.lemonsqueezy.com/buy/abc123",
      workspaceId: wsId.toString(),
    });

    // No in-flight hook -> nothing cancelled.
    expect(mockGetRun).not.toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalledOnce();
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: "1001",
        email: "owner@example.com",
        workspaceId: wsId.toString(),
      })
    );

    const ws = await Workspace.findById(wsId).lean();
    expect(ws?.lsCheckoutWorkflowRunId).toBe("run_new");
  });
});

describe("billing checkout — cadence", () => {
  it("resolves the yearly variantId when cadence is 'yearly'", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro", cadence: "yearly" }));

    expect(res.status).toBe(200);
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: "1002" })
    );
  });
});

describe("billing checkout — post-payment redirect", () => {
  it("targets /onboarding/done when onboarding is true", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro", onboarding: true }));

    expect(res.status).toBe(200);
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUrl: "http://test/onboarding/done" })
    );
  });

  it("targets /settings/billing when onboarding is absent", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro" }));

    expect(res.status).toBe(200);
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUrl: "http://test/settings/billing" })
    );
  });

  it("honors returnTo over the onboarding/default targets", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(
      makeReq({ plan: "pro", returnTo: "/inquiries?inquiryId=abc123" })
    );

    expect(res.status).toBe(200);
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUrl: "http://test/inquiries?inquiryId=abc123",
      })
    );
  });

  it("rejects a non-'/'-prefixed returnTo with 400", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(
      makeReq({ plan: "pro", returnTo: "https://evil.com" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "invalid_request" });
    expect(mockStart).not.toHaveBeenCalled();
  });
});

describe("billing checkout — gated workspace", () => {
  it("allows a gated owner (free plan, everSubscribed) to start checkout", async () => {
    const wsId = await seedWorkspace({ plan: "free" });
    await Workspace.updateOne({ _id: wsId }, { $set: { everSubscribed: true } });
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      checkoutUrl: "https://checkout.lemonsqueezy.com/buy/abc123",
      workspaceId: wsId.toString(),
    });
    expect(mockRequireOrg).toHaveBeenCalledWith(
      expect.objectContaining({ allowWhenGated: true })
    );
  });
});

describe("billing checkout — idempotent init (Bug #2 regression)", () => {
  it("cancels the in-flight workflow run before starting a new one", async () => {
    const wsId = await seedWorkspace({
      lsCheckoutWorkflowRunId: "run_old",
    });
    wireAuth(wsId);

    // A prior abandoned checkout left a run blocked on the hook token.
    mockGetHookByToken.mockResolvedValue({ runId: "run_old" } as never);
    const cancel = vi.fn().mockResolvedValue(undefined);
    mockGetRun.mockReturnValue({ cancel } as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro" }));

    expect(res.status).toBe(200);

    // The stale run was looked up by the deterministic token and cancelled
    // BEFORE the new run was started.
    expect(mockGetHookByToken).toHaveBeenCalledWith(
      `ls-checkout-${wsId.toString()}`
    );
    expect(mockGetRun).toHaveBeenCalledWith("run_old");
    expect(cancel).toHaveBeenCalledOnce();
    expect(mockStart).toHaveBeenCalledOnce();

    const ws = await Workspace.findById(wsId).lean();
    expect(ws?.lsCheckoutWorkflowRunId).toBe("run_new");
  });

  it("still starts a fresh run when cancelling the stale run fails", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    mockGetHookByToken.mockResolvedValue({ runId: "run_old" } as never);
    mockGetRun.mockReturnValue({
      cancel: vi.fn().mockRejectedValue(new Error("cancel boom")),
    } as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro" }));

    expect(res.status).toBe(200);
    expect(mockStart).toHaveBeenCalledOnce();
  });
});

describe("billing checkout — checkout creation failure", () => {
  it("returns 502 when createSubscriptionCheckout throws", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);
    mockCreateCheckout.mockRejectedValue(new Error("lemonsqueezy down"));

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro" }));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: "checkout_init_failed" });
  });

  it("cancels the just-started workflow run when the Lemon Squeezy API call fails after it", async () => {
    // A run started successfully but createSubscriptionCheckout then threw —
    // without cleanup this run would be left parked on its hook indefinitely.
    const wsId = await seedWorkspace();
    wireAuth(wsId);
    mockCreateCheckout.mockRejectedValue(new Error("lemonsqueezy down"));
    const cancel = vi.fn().mockResolvedValue(undefined);
    mockGetRun.mockReturnValue({ cancel } as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro" }));

    expect(res.status).toBe(502);
    expect(mockGetRun).toHaveBeenCalledWith("run_new");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("does not attempt to cancel a run when start() itself never succeeded", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);
    mockStart.mockRejectedValue(new Error("workflow init failed"));

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro" }));

    expect(res.status).toBe(502);
    expect(mockGetRun).not.toHaveBeenCalled();
  });
});

describe("billing checkout — rate limiting", () => {
  it("returns 429 with Retry-After after exceeding the per-workspace limit", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeReq({ plan: "pro" }));
      expect(res.status).toBe(200);
    }

    const res = await POST(makeReq({ plan: "pro" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const body = await res.json();
    expect(body).toEqual({ error: "rate_limited" });
  });

  it("scopes the limit per workspace — a different workspace is unaffected", async () => {
    const wsIdA = await seedWorkspace();
    wireAuth(wsIdA);
    const { POST } = await loadRoute();
    for (let i = 0; i < 5; i++) {
      await POST(makeReq({ plan: "pro" }));
    }
    expect((await POST(makeReq({ plan: "pro" }))).status).toBe(429);

    const wsIdB = await seedWorkspace();
    wireAuth(wsIdB);
    const res = await POST(makeReq({ plan: "pro" }));
    expect(res.status).toBe(200);
  });
});

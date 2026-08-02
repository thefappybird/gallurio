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
const ORIGINAL_PAID_BILLING = process.env.PAID_BILLING_ENABLED;
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

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

import { requireOrg } from "@/lib/auth/requireOrg";
import { createSubscriptionCheckout } from "@/lib/lemonsqueezy/client";
import { getAuthUser } from "@/lib/auth/session";

const mockRequireOrg = vi.mocked(requireOrg);
const mockCreateCheckout = vi.mocked(createSubscriptionCheckout);
const mockGetAuthUser = vi.mocked(getAuthUser);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedWorkspace(opts: {
  plan?: "free" | "pro";
} = {}): Promise<Types.ObjectId> {
  const ws = await Workspace.create({
    clerkOrgId: `org_${Math.random().toString(36).slice(2, 10)}`,
    ownerUserId: "user_owner",
    name: "Test WS",
    slug: `t-${Math.random().toString(36).slice(2, 8)}`,
    plan: opts.plan ?? "free",
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
  if (ORIGINAL_PAID_BILLING === undefined) delete process.env.PAID_BILLING_ENABLED;
  else process.env.PAID_BILLING_ENABLED = ORIGINAL_PAID_BILLING;
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

beforeEach(async () => {
  process.env.PAID_BILLING_ENABLED = "true";
  delete process.env.NEXT_PUBLIC_APP_URL;
  await clearCollections();
  vi.clearAllMocks();
  __resetRateLimitForTests();

  mockCreateCheckout.mockResolvedValue("https://checkout.lemonsqueezy.com/buy/abc123");
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
    expect(mockCreateCheckout).not.toHaveBeenCalled();
  });

  it("rejects the merged-away 'starter' plan as invalid_request", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "starter" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "invalid_request" });
    expect(mockCreateCheckout).not.toHaveBeenCalled();
  });
});

describe("billing checkout — happy path", () => {
  it("calls createSubscriptionCheckout and returns the checkout url without any workflow/run state", async () => {
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

    expect(mockCreateCheckout).toHaveBeenCalledOnce();
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: "1001",
        email: "owner@example.com",
        workspaceId: wsId.toString(),
      })
    );

    const ws = await Workspace.findById(wsId).lean();
    expect(ws).not.toHaveProperty("lsCheckoutWorkflowRunId");
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
  it("uses the configured app URL instead of the request origin", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://dev.gallurio.com/";
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro" }));

    expect(res.status).toBe(200);
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUrl: "https://dev.gallurio.com/billing/return?returnTo=%2Fsettings%2Fbilling",
      })
    );
  });

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

  it("routes non-onboarding returns through billing reconciliation", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro" }));

    expect(res.status).toBe(200);
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUrl: "http://test/billing/return?returnTo=%2Fsettings%2Fbilling",
      })
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
        redirectUrl: "http://test/billing/return?returnTo=%2Finquiries%3FinquiryId%3Dabc123",
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
    expect(mockCreateCheckout).not.toHaveBeenCalled();
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

describe("billing checkout — beta-only mode", () => {
  const ORIGINAL_BETA = process.env.BETA_TESTER_ENABLED;

  afterAll(() => {
    if (ORIGINAL_BETA === undefined) delete process.env.BETA_TESTER_ENABLED;
    else process.env.BETA_TESTER_ENABLED = ORIGINAL_BETA;
  });

  it("fails closed before any Lemon Squeezy call when beta-only mode is active", async () => {
    process.env.BETA_TESTER_ENABLED = "true";
    process.env.PAID_BILLING_ENABLED = "false";
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "pro" }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "billing_unavailable" });
    expect(mockCreateCheckout).not.toHaveBeenCalled();

    delete process.env.BETA_TESTER_ENABLED;
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

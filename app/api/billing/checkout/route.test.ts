import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";

// ---------------------------------------------------------------------------
// Env — read at module-eval time by lib/paddle/plans.ts, so set before import.
// ---------------------------------------------------------------------------
process.env.PADDLE_PRICE_STARTER_ID = "pri_test_starter";
process.env.PADDLE_PRICE_PRO_ID = "pri_test_pro";

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: vi.fn(),
}));

vi.mock("@/lib/paddle/client", () => ({
  ensurePaddleCustomer: vi.fn(),
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
import { ensurePaddleCustomer } from "@/lib/paddle/client";
import { getAuthUser } from "@/lib/auth/session";
import { start, getHookByToken, getRun } from "workflow/api";

const mockRequireOrg = vi.mocked(requireOrg);
const mockEnsureCustomer = vi.mocked(ensurePaddleCustomer);
const mockGetAuthUser = vi.mocked(getAuthUser);
const mockStart = vi.mocked(start);
const mockGetHookByToken = vi.mocked(getHookByToken);
const mockGetRun = vi.mocked(getRun);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedWorkspace(opts: {
  plan?: "free" | "starter" | "pro";
  paddleCustomerId?: string | null;
  paddleCheckoutWorkflowRunId?: string | null;
} = {}): Promise<Types.ObjectId> {
  const ws = await Workspace.create({
    clerkOrgId: `org_${Math.random().toString(36).slice(2, 10)}`,
    ownerUserId: "user_owner",
    name: "Test WS",
    slug: `t-${Math.random().toString(36).slice(2, 8)}`,
    plan: opts.plan ?? "free",
    paddleCustomerId: opts.paddleCustomerId ?? null,
    paddleCheckoutWorkflowRunId: opts.paddleCheckoutWorkflowRunId ?? null,
    country: "PH",
    currency: "PHP",
    timezone: "Asia/Manila",
    businessType: "photographer",
  });
  return ws._id;
}

function wireAuth(wsId: Types.ObjectId, paddleCustomerId: string | null = null) {
  mockRequireOrg.mockResolvedValue({
    workspace: {
      _id: wsId,
      name: "Test WS",
      paddleCustomerId,
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

  mockEnsureCustomer.mockResolvedValue("ctm_default");
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
});

describe("billing checkout — happy path (no stale run)", () => {
  it("starts a workflow, persists customer + run id, and returns the price id", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "starter" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      priceId: "pri_test_starter",
      customerEmail: "owner@example.com",
      workspaceId: wsId.toString(),
    });

    // No in-flight hook -> nothing cancelled.
    expect(mockGetRun).not.toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalledOnce();

    const ws = await Workspace.findById(wsId).lean();
    expect(ws?.paddleCustomerId).toBe("ctm_default");
    expect(ws?.paddleCheckoutWorkflowRunId).toBe("run_new");
  });
});

describe("billing checkout — idempotent init (Bug #2 regression)", () => {
  it("cancels the in-flight workflow run before starting a new one", async () => {
    const wsId = await seedWorkspace({
      paddleCheckoutWorkflowRunId: "run_old",
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
      `paddle-checkout-${wsId.toString()}`
    );
    expect(mockGetRun).toHaveBeenCalledWith("run_old");
    expect(cancel).toHaveBeenCalledOnce();
    expect(mockStart).toHaveBeenCalledOnce();

    const ws = await Workspace.findById(wsId).lean();
    expect(ws?.paddleCheckoutWorkflowRunId).toBe("run_new");
  });

  it("still starts a fresh run when cancelling the stale run fails", async () => {
    const wsId = await seedWorkspace();
    wireAuth(wsId);

    mockGetHookByToken.mockResolvedValue({ runId: "run_old" } as never);
    mockGetRun.mockReturnValue({
      cancel: vi.fn().mockRejectedValue(new Error("cancel boom")),
    } as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ plan: "starter" }));

    expect(res.status).toBe(200);
    expect(mockStart).toHaveBeenCalledOnce();
  });
});

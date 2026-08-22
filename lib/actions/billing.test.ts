import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth/ownerContext", () => ({
  ownerContext: vi.fn(),
}));

vi.mock("@/lib/lemonsqueezy/client", () => ({
  getLemonSqueezySubscription: vi.fn(),
}));

vi.mock("@/lib/actions/onboarding", () => ({
  reconcileLemonSqueezySubscription: vi.fn(),
}));

vi.mock("@/lib/db/models", () => ({
  Workspace: { findById: vi.fn() },
}));

import { ownerContext } from "@/lib/auth/ownerContext";
import { getLemonSqueezySubscription } from "@/lib/lemonsqueezy/client";
import { reconcileLemonSqueezySubscription } from "@/lib/actions/onboarding";
import { Workspace } from "@/lib/db/models";
import { getSubscriptionManageUrlAction, verifyCheckoutReturnAction } from "./billing";

const mockOwnerContext = vi.mocked(ownerContext);
const mockGetSubscription = vi.mocked(getLemonSqueezySubscription);
const mockReconcile = vi.mocked(reconcileLemonSqueezySubscription);
const mockWorkspaceFindById = vi.mocked(Workspace.findById);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSubscriptionManageUrlAction", () => {
  const ORIGINAL_PAID_BILLING = process.env.PAID_BILLING_ENABLED;
  const ORIGINAL_BETA = process.env.BETA_TESTER_ENABLED;
  beforeEach(() => {
    process.env.PAID_BILLING_ENABLED = "true";
  });
  afterEach(() => {
    if (ORIGINAL_PAID_BILLING === undefined) delete process.env.PAID_BILLING_ENABLED;
    else process.env.PAID_BILLING_ENABLED = ORIGINAL_PAID_BILLING;
    if (ORIGINAL_BETA === undefined) delete process.env.BETA_TESTER_ENABLED;
    else process.env.BETA_TESTER_ENABLED = ORIGINAL_BETA;
  });

  it("fails closed with billing_unavailable in beta-only mode, without calling Lemon Squeezy", async () => {
    process.env.BETA_TESTER_ENABLED = "true";
    process.env.PAID_BILLING_ENABLED = "false";
    mockOwnerContext.mockResolvedValue({
      userId: "u1",
      workspaceId: "ws1",
      workspace: { lsSubscriptionId: "sub_1" } as never,
    });

    const result = await getSubscriptionManageUrlAction();

    expect(result).toEqual({ error: "billing_unavailable" });
    expect(mockGetSubscription).not.toHaveBeenCalled();
  });

  it("returns the error from ownerContext when the caller isn't authorized", async () => {
    mockOwnerContext.mockResolvedValue({ error: "not_authenticated" });

    const result = await getSubscriptionManageUrlAction();

    expect(result).toEqual({ error: "not_authenticated" });
    expect(mockGetSubscription).not.toHaveBeenCalled();
  });

  it("returns no_subscription when the workspace has no lsSubscriptionId", async () => {
    mockOwnerContext.mockResolvedValue({
      userId: "u1",
      workspaceId: "ws1",
      workspace: { lsSubscriptionId: null } as never,
    });

    const result = await getSubscriptionManageUrlAction();

    expect(result).toEqual({ error: "no_subscription" });
    expect(mockGetSubscription).not.toHaveBeenCalled();
  });

  it("returns subscription_manage_unavailable when Lemon Squeezy errors", async () => {
    mockOwnerContext.mockResolvedValue({
      userId: "u1",
      workspaceId: "ws1",
      workspace: { lsSubscriptionId: "sub_1" } as never,
    });
    mockGetSubscription.mockResolvedValue({
      data: null,
      error: new Error("not found"),
    } as never);

    const result = await getSubscriptionManageUrlAction();

    expect(result).toEqual({ error: "subscription_manage_unavailable" });
  });

  it("returns the customer portal URL on success", async () => {
    mockOwnerContext.mockResolvedValue({
      userId: "u1",
      workspaceId: "ws1",
      workspace: { lsSubscriptionId: "sub_1" } as never,
    });
    mockGetSubscription.mockResolvedValue({
      data: {
        data: {
          attributes: {
            urls: {
              customer_portal: "https://gallurio.lemonsqueezy.com/billing",
              customer_portal_update_subscription:
                "https://gallurio.lemonsqueezy.com/billing/portal/sub_1",
            },
          },
        },
      },
      error: null,
    } as never);

    const result = await getSubscriptionManageUrlAction();

    expect(result).toEqual({
      ok: true,
      url: "https://gallurio.lemonsqueezy.com/billing/portal/sub_1",
    });
  });
});

describe("verifyCheckoutReturnAction", () => {
  it("permits a gated owner, reconciles, and confirms the freshly-read active subscription", async () => {
    process.env.PAID_BILLING_ENABLED = "true";
    mockOwnerContext.mockResolvedValue({ userId: "u1", workspaceId: "ws1", workspace: {} } as never);
    mockReconcile.mockResolvedValue(undefined);
    mockWorkspaceFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        plan: "pro",
        everSubscribed: true,
        lsSubscriptionId: "sub_new",
        lsSubscriptionStatus: "active",
      }),
    } as never);

    await expect(verifyCheckoutReturnAction()).resolves.toEqual({ ok: true });
    expect(mockOwnerContext).toHaveBeenCalledWith({ allowDuringOnboarding: true, allowWhenGated: true });
    expect(mockReconcile).toHaveBeenCalledWith("ws1");
  });

  it("does not redirect access when reconciliation cannot establish entitlement", async () => {
    process.env.PAID_BILLING_ENABLED = "true";
    mockOwnerContext.mockResolvedValue({ userId: "u1", workspaceId: "ws1", workspace: {} } as never);
    mockWorkspaceFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ plan: "free", everSubscribed: true, lsSubscriptionId: null }),
    } as never);

    await expect(verifyCheckoutReturnAction()).resolves.toEqual({ ok: false });
  });
});

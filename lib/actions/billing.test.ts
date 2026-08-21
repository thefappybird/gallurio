import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/ownerContext", () => ({
  ownerContext: vi.fn(),
}));

vi.mock("@/lib/lemonsqueezy/client", () => ({
  getLemonSqueezySubscription: vi.fn(),
}));

import { ownerContext } from "@/lib/auth/ownerContext";
import { getLemonSqueezySubscription } from "@/lib/lemonsqueezy/client";
import { getSubscriptionManageUrlAction } from "./billing";

const mockOwnerContext = vi.mocked(ownerContext);
const mockGetSubscription = vi.mocked(getLemonSqueezySubscription);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSubscriptionManageUrlAction", () => {
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

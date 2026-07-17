import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace, User, PromoCode } from "@/lib/db/models";
import { isEntitled } from "@/lib/billing/access";

// ---------------------------------------------------------------------------
// Module mocks — mirrors app/api/webhooks/lemonsqueezy/route.test.ts and
// lib/actions/promoCode.test.ts so both the redemption action and the
// webhook route can run against the same in-memory DB in one test.
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/session", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/auth/activeWorkspace", () => ({ getActiveWorkspaceId: vi.fn() }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: async () => undefined }));
vi.mock("@/lib/lemonsqueezy/webhook", async () => {
  const actual = await vi.importActual<typeof import("@/lib/lemonsqueezy/webhook")>(
    "@/lib/lemonsqueezy/webhook"
  );
  return { ...actual, verifyAndParseLemonSqueezyEvent: vi.fn() };
});
process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID = "1001";
process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID = "1002";

import { getAuthUser } from "@/lib/auth/session";
import { getActiveWorkspaceId } from "@/lib/auth/activeWorkspace";
import { verifyAndParseLemonSqueezyEvent } from "@/lib/lemonsqueezy/webhook";
import { redeemPromoCodeAction } from "@/lib/actions/promoCode";
import { runBillingLifecycleSweep } from "@/lib/db/jobs/billing-lifecycle-sweep";

const mockGetAuthUser = vi.mocked(getAuthUser);
const mockGetActiveWorkspaceId = vi.mocked(getActiveWorkspaceId);
const mockVerify = vi.mocked(verifyAndParseLemonSqueezyEvent);

function makeExpiredEvent(subId: string) {
  return {
    meta: { event_name: "subscription_expired", custom_data: null },
    data: { id: subId, attributes: { status: "expired", customer_id: "ctm_1" } },
  };
}

function makeReq() {
  return new Request("http://test/api/webhooks/lemonsqueezy", {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": "stub" },
    body: "{}",
  });
}

async function seedActiveSubOwner(slug: string, subId: string) {
  const wosId = `wos_${slug}`;
  const ws = await Workspace.create({
    slug,
    name: "No False Expiry WS",
    ownerUserId: wosId,
    plan: "pro",
    country: "PH",
    lsSubscriptionId: subId,
    lsSubscriptionStatus: "active",
    lsCustomerId: "cust_1",
  });
  await User.create({
    workosUserId: wosId,
    email: `${wosId}@example.com`,
    memberships: [{ workspaceId: ws._id, role: "owner", lastAccessedAt: new Date() }],
    onboardingStep: "done",
    onboardingCompletedAt: new Date(),
    betaParticipation: { recordedAt: new Date(), source: "onboarding" },
  });
  mockGetAuthUser.mockResolvedValue({
    workosUserId: wosId,
    email: `${wosId}@example.com`,
    name: "Owner",
    avatarUrl: null,
  } as never);
  mockGetActiveWorkspaceId.mockResolvedValue(ws._id.toString());
  return ws;
}

beforeAll(async () => {
  await startInMemoryMongo();
}, 120_000);
afterAll(async () => {
  await stopInMemoryMongo();
});
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(async () => {
  await clearCollections();
});

describe("no-false-expiry invariant across a paid-to-promo transition", () => {
  it("stays entitled throughout and lands on plan:pro (never free) via the webhook's subscription_expired path", async () => {
    const ws = await seedActiveSubOwner("nfe-webhook-ws", "sub_nfe_webhook");
    await PromoCode.create({ title: "nfe code a", code: "nfewebhook1", type: "beta2mo" });

    const redeemResult = await redeemPromoCodeAction("nfewebhook1");
    expect(redeemResult).toEqual({ ok: true, startsImmediately: false });

    const afterRedeem = await Workspace.findById(ws._id).lean();
    expect(isEntitled(afterRedeem!)).toBe(true);
    expect(afterRedeem?.pendingPromoGrant?.grantMonths).toBe(2);

    const { POST } = await import("@/app/api/webhooks/lemonsqueezy/route");
    mockVerify.mockResolvedValue(makeExpiredEvent("sub_nfe_webhook") as never);
    const res = await POST(makeReq());
    expect(res.status).toBe(200);

    const afterExpiry = await Workspace.findById(ws._id).lean();
    expect(isEntitled(afterExpiry!)).toBe(true);
    expect(afterExpiry?.plan).toBe("pro");
    expect(afterExpiry?.plan).not.toBe("free");
    expect(afterExpiry?.planGrantExpiresAt).toBeInstanceOf(Date);
    const daysUntilExpiry =
      (afterExpiry!.planGrantExpiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysUntilExpiry).toBeGreaterThan(55);
    expect(daysUntilExpiry).toBeLessThan(65);
  });

  it("stays entitled throughout and lands on plan:pro (never free) via the lifecycle sweep's canceled-past-period-end path", async () => {
    const ws = await seedActiveSubOwner("nfe-sweep-ws", "sub_nfe_sweep");
    await PromoCode.create({ title: "nfe code b", code: "nfesweep1", type: "beta2mo" });

    const redeemResult = await redeemPromoCodeAction("nfesweep1");
    expect(redeemResult).toEqual({ ok: true, startsImmediately: false });

    const afterRedeem = await Workspace.findById(ws._id).lean();
    expect(isEntitled(afterRedeem!)).toBe(true);

    // Simulate the subscription having been canceled (webhook already fired
    // subscription_cancelled) and its period now over — the sweep's
    // defensive canceled-past-period-end branch, driven with a future `now`.
    const periodEnd = new Date();
    await Workspace.updateOne(
      { _id: ws._id },
      { $set: { lsSubscriptionStatus: "canceled", lsCurrentPeriodEnd: periodEnd } }
    );
    const future = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000);

    await runBillingLifecycleSweep(future);

    const afterSweep = await Workspace.findById(ws._id).lean();
    expect(isEntitled(afterSweep!)).toBe(true);
    expect(afterSweep?.plan).toBe("pro");
    expect(afterSweep?.plan).not.toBe("free");
    expect(afterSweep?.planGrantExpiresAt).toBeInstanceOf(Date);
    expect(afterSweep?.lifecycle?.lapsedAt).toBeNull();
  });
});

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";
import { Workspace, User } from "@/lib/db/models";

const { mockSendLifecycleEmail } = vi.hoisted(() => ({
  mockSendLifecycleEmail: vi.fn().mockResolvedValue({ ok: true, id: "email_1" }),
}));
vi.mock("@/lib/email/lifecycle", () => ({
  sendLifecycleEmail: mockSendLifecycleEmail,
}));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));

import { runBillingLifecycleSweep } from "./billing-lifecycle-sweep";

beforeAll(async () => {
  await startInMemoryMongo();
});
afterAll(async () => {
  await stopInMemoryMongo();
});
afterEach(async () => {
  await clearCollections();
  vi.clearAllMocks();
});

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function seedLapsedWorkspace(opts: {
  lapsedAt: Date;
  remind1moAt?: Date | null;
  country?: string;
}) {
  const ownerUserId = `wos_owner_${Math.random().toString(36).slice(2, 8)}`;
  await User.create({
    workosUserId: ownerUserId,
    email: `${ownerUserId}@example.com`,
  });
  const ws = await Workspace.create({
    slug: `lapsed-${Math.random().toString(36).slice(2, 8)}`,
    name: "Lapsed WS",
    ownerUserId,
    plan: "free",
    country: opts.country ?? "PH",
    lifecycle: {
      lapsedAt: opts.lapsedAt,
      remind1moAt: opts.remind1moAt ?? null,
    },
  });
  return ws._id;
}

describe("runBillingLifecycleSweep — remind1", () => {
  it("sends the remind1 email and stamps remind1moAt for a workspace lapsed 30+ days ago", async () => {
    const wsId = await seedLapsedWorkspace({ lapsedAt: daysAgo(31) });

    const report = await runBillingLifecycleSweep(new Date());

    expect(report.remind1Sent).toBe(1);
    expect(mockSendLifecycleEmail).toHaveBeenCalledWith(
      "remind1",
      expect.stringContaining("@example.com"),
      "PH",
    );
    const after = await Workspace.findById(wsId).lean();
    expect(after?.lifecycle?.remind1moAt).toBeInstanceOf(Date);
  });

  it("does not send a duplicate remind1 email on a second sweep run (idempotent)", async () => {
    await seedLapsedWorkspace({ lapsedAt: daysAgo(31) });

    const first = await runBillingLifecycleSweep(new Date());
    expect(first.remind1Sent).toBe(1);

    const second = await runBillingLifecycleSweep(new Date());
    expect(second.remind1Sent).toBe(0);

    const remind1Calls = mockSendLifecycleEmail.mock.calls.filter(
      (call) => call[0] === "remind1",
    );
    expect(remind1Calls).toHaveLength(1);
  });

  it("skips a workspace that became entitled again despite a stale lifecycle.lapsedAt", async () => {
    const wsId = await seedLapsedWorkspace({ lapsedAt: daysAgo(31) });
    // Simulate a workspace that resubscribed but whose lifecycle fields were
    // not cleared for some reason (defensive isEntitled check must catch it).
    await Workspace.updateOne(
      { _id: wsId },
      {
        $set: {
          lsSubscriptionId: "sub_active_again",
          lsSubscriptionStatus: "active",
        },
      },
    );

    const report = await runBillingLifecycleSweep(new Date());

    expect(report.remind1Sent).toBe(0);
    expect(mockSendLifecycleEmail).not.toHaveBeenCalledWith(
      "remind1",
      expect.anything(),
      expect.anything(),
    );
  });
});

describe("runBillingLifecycleSweep — expired-notify re-entitlement guard", () => {
  it("skips the expired email for a workspace that resubscribed despite a stale lifecycle.lapsedAt", async () => {
    const wsId = await seedLapsedWorkspace({ lapsedAt: daysAgo(1) });
    // Simulate a resubscribe whose webhook handler has not yet cleared
    // lifecycle.lapsedAt (race between the sweep and lifecycleResetFields()).
    await Workspace.updateOne(
      { _id: wsId },
      {
        $set: {
          lsSubscriptionId: "sub_active_again",
          lsSubscriptionStatus: "active",
        },
      },
    );

    const report = await runBillingLifecycleSweep(new Date());

    expect(report.expiredNotified).toBe(0);
    expect(mockSendLifecycleEmail).not.toHaveBeenCalledWith(
      "expired",
      expect.anything(),
      expect.anything(),
    );
    const after = await Workspace.findById(wsId).lean();
    expect(after?.lifecycle?.expiredNotifiedAt).toBeNull();
  });
});

describe("runBillingLifecycleSweep — retry on email failure", () => {
  it("leaves remind1moAt null and does not count the row when sendLifecycleEmail fails, then stamps and counts it on a clean retry", async () => {
    const wsId = await seedLapsedWorkspace({ lapsedAt: daysAgo(31) });
    // Pre-stamp expiredNotifiedAt so stageExpiredNotify (which runs before
    // stageRemind and also calls sendLifecycleEmail) does not consume the
    // once-mocked failure meant for the remind1 send below.
    await Workspace.updateOne({ _id: wsId }, { $set: { "lifecycle.expiredNotifiedAt": daysAgo(31) } });
    mockSendLifecycleEmail.mockResolvedValueOnce({ ok: false, error: "resend down" });

    const first = await runBillingLifecycleSweep(new Date());
    expect(first.remind1Sent).toBe(0);
    const afterFailure = await Workspace.findById(wsId).lean();
    expect(afterFailure?.lifecycle?.remind1moAt).toBeNull();

    const second = await runBillingLifecycleSweep(new Date());
    expect(second.remind1Sent).toBe(1);
    const afterRetry = await Workspace.findById(wsId).lean();
    expect(afterRetry?.lifecycle?.remind1moAt).toBeInstanceOf(Date);

    const remind1Calls = mockSendLifecycleEmail.mock.calls.filter((call) => call[0] === "remind1");
    expect(remind1Calls).toHaveLength(2);
  });
});

describe("runBillingLifecycleSweep — wipe", () => {
  it("unpublishes the live public page at +58d while preserving draft data and CRM records", async () => {
    const ownerUserId = "wos_owner_wipe";
    await User.create({ workosUserId: ownerUserId, email: "owner_wipe@example.com" });
    const ws = await Workspace.create({
      slug: "wipe-target",
      name: "Wipe Target",
      ownerUserId,
      plan: "free",
      country: "PH",
      publicPage: {
        publishedAt: new Date(),
        data: { home: { content: [{ type: "Hero" }], root: {} }, gallery: null },
      },
      lifecycle: { lapsedAt: daysAgo(59) },
    });

    const { Client, Booking } = await import("@/lib/db/models");
    const client = await Client.create({
      workspaceId: ws._id,
      name: "Test Client",
      email: "client@example.com",
    });
    const sessionStart = new Date();
    const sessionEnd = new Date(Date.now() + 3600_000);
    await Booking.create({
      workspaceId: ws._id,
      clientId: client._id,
      clientName: "Test Client",
      title: "Test Booking",
      status: "booked",
      sessions: [{ startAt: sessionStart, endAt: sessionEnd }],
      firstSessionStart: sessionStart,
      lastSessionEnd: sessionEnd,
    });

    const report = await runBillingLifecycleSweep(new Date());
    expect(report.wiped).toBe(1);

    const after = await Workspace.findById(ws._id).lean();
    expect(after?.publicPage?.publishedAt).toBeNull();
    expect(after?.lifecycle?.wipedAt).toBeInstanceOf(Date);
    // Draft/source data untouched.
    expect(
      (after?.publicPage?.data?.home as { content: unknown[] } | undefined)?.content,
    ).toEqual([{ type: "Hero" }]);

    const clientAfter = await Client.findById(client._id).lean();
    const bookingCount = await Booking.countDocuments({ workspaceId: ws._id });
    expect(clientAfter).not.toBeNull();
    expect(bookingCount).toBe(1);
  });
});

describe("runBillingLifecycleSweep — pre-expiry warn", () => {
  it("sends the preExpiry email for a grant-backed workspace expiring within 7 days", async () => {
    const ownerUserId = "wos_owner_preexpiry";
    await User.create({ workosUserId: ownerUserId, email: "owner_preexpiry@example.com" });
    await Workspace.create({
      slug: "preexpiry-ws",
      name: "PreExpiry WS",
      ownerUserId,
      plan: "pro",
      country: "PH",
      planGrantExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });

    const report = await runBillingLifecycleSweep(new Date());

    expect(report.preExpiryWarned).toBe(1);
    expect(mockSendLifecycleEmail).toHaveBeenCalledWith(
      "preExpiry",
      "owner_preexpiry@example.com",
      "PH",
    );
  });
});

describe("runBillingLifecycleSweep — lapse detection (free-month / grant expiry)", () => {
  it("flips a grant-backed workspace to free and stamps lifecycle.lapsedAt once its grant has passed", async () => {
    const ownerUserId = "wos_owner_grant_lapse";
    await User.create({ workosUserId: ownerUserId, email: "owner_grant_lapse@example.com" });
    const ws = await Workspace.create({
      slug: "grant-lapse-ws",
      name: "Grant Lapse WS",
      ownerUserId,
      plan: "pro",
      country: "PH",
      planGrantExpiresAt: daysAgo(1),
    });

    const report = await runBillingLifecycleSweep(new Date());

    expect(report.lapsed).toBe(1);
    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("free");
    expect(after?.planGrantExpiresAt).toBeNull();
    expect(after?.lifecycle?.lapsedAt).toBeInstanceOf(Date);
  });
});

describe("runBillingLifecycleSweep — queued promo grant at lapse detection", () => {
  it("applies a queued grant instead of flipping to free when a canceled subscription's period ends", async () => {
    const ownerUserId = "wos_owner_queued_grant_lapse";
    await User.create({ workosUserId: ownerUserId, email: "owner_queued_grant_lapse@example.com" });
    const periodEnd = daysAgo(1);
    const ws = await Workspace.create({
      slug: "queued-grant-lapse-ws",
      name: "Queued Grant Lapse WS",
      ownerUserId,
      plan: "pro",
      country: "PH",
      lsSubscriptionId: "sub_queued_grant",
      lsSubscriptionStatus: "canceled",
      lsCurrentPeriodEnd: periodEnd,
      pendingPromoGrant: { grantMonths: 2, queuedAt: daysAgo(2) },
    });

    const report = await runBillingLifecycleSweep(new Date());

    expect(report.lapsed).toBe(1);
    const after = await Workspace.findById(ws._id).lean();
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionId).toBeNull();
    expect(after?.planGrantExpiresAt).toBeInstanceOf(Date);
    expect(after?.pendingPromoGrant?.grantMonths).toBeNull();
    expect(after?.lifecycle?.lapsedAt).toBeNull();
  });
});

describe("runBillingLifecycleSweep — defensive canceled-sub lapse anchor", () => {
  it("stamps lifecycle.lapsedAt for a canceled subscription past its period end without touching plan/subscription fields", async () => {
    const ownerUserId = "wos_owner_canceled_no_webhook";
    await User.create({ workosUserId: ownerUserId, email: "owner_canceled_no_webhook@example.com" });
    const periodEnd = daysAgo(1);
    const ws = await Workspace.create({
      slug: "canceled-no-webhook-ws",
      name: "Canceled No Webhook WS",
      ownerUserId,
      plan: "pro",
      country: "PH",
      lsSubscriptionId: "sub_canceled_stuck",
      lsSubscriptionStatus: "canceled",
      lsCurrentPeriodEnd: periodEnd,
    });

    const report = await runBillingLifecycleSweep(new Date());

    expect(report.lapsed).toBe(1);
    const after = await Workspace.findById(ws._id).lean();
    expect(after?.lifecycle?.lapsedAt).toBeInstanceOf(Date);
    // Only the lifecycle anchor changes — plan/subscription fields untouched.
    expect(after?.plan).toBe("pro");
    expect(after?.lsSubscriptionId).toBe("sub_canceled_stuck");
    expect(after?.lsSubscriptionStatus).toBe("canceled");
    expect(after?.lsCurrentPeriodEnd?.getTime()).toBe(periodEnd.getTime());
  });

  it("does not double-stamp lifecycle.lapsedAt on a second sweep run (idempotent)", async () => {
    const ownerUserId = "wos_owner_canceled_idempotent";
    await User.create({ workosUserId: ownerUserId, email: "owner_canceled_idempotent@example.com" });
    const ws = await Workspace.create({
      slug: "canceled-idempotent-ws",
      name: "Canceled Idempotent WS",
      ownerUserId,
      plan: "pro",
      country: "PH",
      lsSubscriptionId: "sub_canceled_idempotent",
      lsSubscriptionStatus: "canceled",
      lsCurrentPeriodEnd: daysAgo(1),
    });

    const first = await runBillingLifecycleSweep(new Date());
    expect(first.lapsed).toBe(1);
    const afterFirst = await Workspace.findById(ws._id).lean();
    const stampedAt = afterFirst?.lifecycle?.lapsedAt;

    const second = await runBillingLifecycleSweep(new Date());
    expect(second.lapsed).toBe(0);
    const afterSecond = await Workspace.findById(ws._id).lean();
    expect(afterSecond?.lifecycle?.lapsedAt?.getTime()).toBe(stampedAt?.getTime());
  });
});

describe("runBillingLifecycleSweep — free-month vs paid-Pro lapse parity", () => {
  it("fires remind1 identically for a paid-Pro lapse (lapsedAt set by the webhook, no grant) and a grant lapse", async () => {
    const paidWsId = await seedLapsedWorkspace({ lapsedAt: daysAgo(31) });
    // Simulate the webhook's expiry shape: lsSubscriptionId already cleared,
    // no planGrantExpiresAt ever set — lapsedAt is the only lapse signal.
    await Workspace.updateOne(
      { _id: paidWsId },
      { $set: { everSubscribed: true, lsSubscriptionId: null, lsSubscriptionStatus: null } },
    );

    const report = await runBillingLifecycleSweep(new Date());

    expect(report.remind1Sent).toBe(1);
    const after = await Workspace.findById(paidWsId).lean();
    expect(after?.lifecycle?.remind1moAt).toBeInstanceOf(Date);
  });
});

describe("runBillingLifecycleSweep — pagination", () => {
  it("processes every matching workspace across multiple small batches", async () => {
    const total = 5;
    for (let i = 0; i < total; i++) {
      await seedLapsedWorkspace({ lapsedAt: daysAgo(31) });
    }

    const report = await runBillingLifecycleSweep(new Date(), { batchSize: 2 });

    expect(report.remind1Sent).toBe(total);
  });
});

describe("runBillingLifecycleSweep — tenant isolation", () => {
  it("only stamps and emails the lapsed workspace, leaving an unrelated entitled workspace untouched", async () => {
    const lapsedId = await seedLapsedWorkspace({ lapsedAt: daysAgo(31) });

    const otherOwnerUserId = "wos_owner_other_entitled";
    await User.create({ workosUserId: otherOwnerUserId, email: "other@example.com" });
    const entitledWsId = (
      await Workspace.create({
        slug: "other-entitled-ws",
        name: "Other Entitled WS",
        ownerUserId: otherOwnerUserId,
        plan: "pro",
        country: "PH",
        lsSubscriptionId: "sub_other_active",
        lsSubscriptionStatus: "active",
      })
    )._id;

    await runBillingLifecycleSweep(new Date());

    const lapsedAfter = await Workspace.findById(lapsedId).lean();
    const entitledAfter = await Workspace.findById(entitledWsId).lean();
    expect(lapsedAfter?.lifecycle?.remind1moAt).toBeInstanceOf(Date);
    expect(entitledAfter?.lifecycle?.remind1moAt).toBeNull();
    expect(entitledAfter?.plan).toBe("pro");
  });
});

describe("runBillingLifecycleSweep — remind2 and wipe boundaries", () => {
  it("fires remind2 at +51d and does not wipe until +58d", async () => {
    const wsId = await seedLapsedWorkspace({ lapsedAt: daysAgo(52) });

    const report = await runBillingLifecycleSweep(new Date());

    expect(report.remind2Sent).toBe(1);
    expect(report.wiped).toBe(0);
    const after = await Workspace.findById(wsId).lean();
    expect(after?.lifecycle?.remind7wkAt).toBeInstanceOf(Date);
    expect(after?.lifecycle?.wipedAt).toBeNull();
  });
});

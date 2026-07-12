import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, User } from "@/lib/db/models";
import { isEntitled, type WorkspaceBillingFields } from "@/lib/billing/access";
import {
  addDays,
  PRE_EXPIRY_WARN_DAYS,
  REMIND_1_DAYS,
  REMIND_2_DAYS,
  WIPE_DAYS,
} from "@/lib/billing/lifecycle";
import { sendLifecycleEmail } from "@/lib/email/lifecycle";

export type BillingLifecycleSweepReport = {
  preExpiryWarned: number;
  lapsed: number;
  expiredNotified: number;
  remind1Sent: number;
  remind2Sent: number;
  wiped: number;
};

const DEFAULT_BATCH_SIZE = 200;

type WithId = { _id: Types.ObjectId };

// Cursor-paginated sweep over Workspace docs matching `filter`, capped at
// `batchSize` per page. `handleBatch` receives each page and returns how many
// docs in it were actually acted on (so callers can skip re-entitled rows
// without inflating the stage's reported count).
async function forEachBatch<T extends WithId>(
  filter: Record<string, unknown>,
  projection: Record<string, 1>,
  batchSize: number,
  handleBatch: (docs: T[]) => Promise<number>
): Promise<number> {
  let processed = 0;
  let lastId: Types.ObjectId | null = null;
  for (;;) {
    const query: Record<string, unknown> = lastId
      ? { ...filter, _id: { $gt: lastId } }
      : filter;
    const batch = await Workspace.find(query)
      .select(projection)
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean<T[]>();
    if (batch.length === 0) break;
    processed += await handleBatch(batch);
    lastId = batch[batch.length - 1]!._id;
    if (batch.length < batchSize) break;
  }
  return processed;
}

// Batch-resolves owner emails for a page of workspaces via a single $in query
// (avoids N+1 lookups per workspace).
async function ownerEmailsFor(
  docs: Array<{ ownerUserId: string }>
): Promise<Map<string, string>> {
  const ids = [...new Set(docs.map((d) => d.ownerUserId))];
  if (ids.length === 0) return new Map();
  const users = await User.find({ workosUserId: { $in: ids } })
    .select({ workosUserId: 1, email: 1 })
    .lean<Array<{ workosUserId: string; email: string }>>();
  return new Map(users.map((u) => [u.workosUserId, u.email]));
}

type PreExpiryDoc = WithId & { ownerUserId: string; country: string | null };

// Stage 1: an upcoming expiry (grant or canceled-sub period end) within the
// PRE_EXPIRY_WARN_DAYS window, not yet lapsed, not yet warned.
async function stagePreExpiryWarn(now: Date, batchSize: number): Promise<number> {
  const warnBefore = addDays(now, PRE_EXPIRY_WARN_DAYS);
  const filter = {
    "lifecycle.warned7dAt": null,
    "lifecycle.lapsedAt": null,
    $or: [
      { lsSubscriptionId: null, planGrantExpiresAt: { $gt: now, $lte: warnBefore } },
      { lsSubscriptionStatus: "canceled", lsCurrentPeriodEnd: { $gt: now, $lte: warnBefore } },
    ],
  };
  const projection = { _id: 1, ownerUserId: 1, country: 1 } as const;

  return forEachBatch<PreExpiryDoc>(filter, projection, batchSize, async (batch) => {
    const emails = await ownerEmailsFor(batch);
    for (const ws of batch) {
      const email = emails.get(ws.ownerUserId);
      if (email) await sendLifecycleEmail("preExpiry", email, ws.country);
      await Workspace.updateOne({ _id: ws._id }, { $set: { "lifecycle.warned7dAt": now } });
    }
    return batch.length;
  });
}

// Stage 2a: authoritative grant-expiry detection. Flips a grant-backed
// workspace (no lsSubscriptionId) whose planGrantExpiresAt has passed to
// free and stamps lifecycle.lapsedAt exactly once.
async function stageLapseDetect(now: Date, batchSize: number): Promise<number> {
  const filter = {
    lsSubscriptionId: null,
    planGrantExpiresAt: { $ne: null, $lte: now },
    "lifecycle.lapsedAt": null,
  };
  const projection = { _id: 1 } as const;

  return forEachBatch<WithId>(filter, projection, batchSize, async (batch) => {
    for (const ws of batch) {
      // Guard lapsedAt: null again in the write filter. A concurrent run
      // (or the lazy expireGrantIfPast path) may have stamped it already.
      await Workspace.updateOne(
        { _id: ws._id, "lifecycle.lapsedAt": null },
        { $set: { plan: "free", planGrantExpiresAt: null, "lifecycle.lapsedAt": now } }
      );
    }
    return batch.length;
  });
}

type ExpiredNotifyDoc = WithId & { ownerUserId: string; country: string | null };

// Stage 2b: send the expired email once per workspace that has lapsed
// (either via the webhook paid-Pro path or stage 2a grant path above) and
// has not been notified yet.
async function stageExpiredNotify(now: Date, batchSize: number): Promise<number> {
  const filter = {
    "lifecycle.lapsedAt": { $ne: null },
    "lifecycle.expiredNotifiedAt": null,
  };
  const projection = { _id: 1, ownerUserId: 1, country: 1 } as const;

  return forEachBatch<ExpiredNotifyDoc>(filter, projection, batchSize, async (batch) => {
    const emails = await ownerEmailsFor(batch);
    for (const ws of batch) {
      const email = emails.get(ws.ownerUserId);
      if (email) await sendLifecycleEmail("expired", email, ws.country);
      await Workspace.updateOne({ _id: ws._id }, { $set: { "lifecycle.expiredNotifiedAt": now } });
    }
    return batch.length;
  });
}

type RemindDoc = WithId &
  WorkspaceBillingFields & { ownerUserId: string; country: string | null };

const REMIND_PROJECTION = {
  _id: 1,
  ownerUserId: 1,
  country: 1,
  plan: 1,
  everSubscribed: 1,
  lsSubscriptionId: 1,
  lsSubscriptionStatus: 1,
  lsCurrentPeriodEnd: 1,
  planGrantExpiresAt: 1,
} as const;

// Stages 3/4: remind-1 (+30d) and remind-2 (+51d) after lapsedAt. Both skip a
// workspace that has become entitled again (its lifecycle.* would normally
// already be null from the webhook reset, but isEntitled is checked
// defensively in case that reset has not landed yet).
async function stageRemind(
  now: Date,
  batchSize: number,
  offsetDays: number,
  guardField: "remind1moAt" | "remind7wkAt",
  stage: "remind1" | "remind2"
): Promise<number> {
  const boundary = addDays(now, -offsetDays);
  const filter = {
    "lifecycle.lapsedAt": { $ne: null, $lte: boundary },
    [`lifecycle.${guardField}`]: null,
  };

  return forEachBatch<RemindDoc>(filter, REMIND_PROJECTION, batchSize, async (batch) => {
    const stillGated = batch.filter((ws) => !isEntitled(ws));
    if (stillGated.length === 0) return 0;
    const emails = await ownerEmailsFor(stillGated);
    for (const ws of stillGated) {
      const email = emails.get(ws.ownerUserId);
      if (email) await sendLifecycleEmail(stage, email, ws.country);
      await Workspace.updateOne({ _id: ws._id }, { $set: { [`lifecycle.${guardField}`]: now } });
    }
    return stillGated.length;
  });
}

// Stage 5: wipe (+58d). Takes the live public page offline (clears
// publicPage.publishedAt only). Draft data, brand kit, and every CRM
// collection (bookings/clients/gallery/inquiries) are untouched.
async function stageWipe(now: Date, batchSize: number): Promise<number> {
  const boundary = addDays(now, -WIPE_DAYS);
  const filter = {
    "lifecycle.lapsedAt": { $ne: null, $lte: boundary },
    "lifecycle.wipedAt": null,
  };
  const projection = {
    _id: 1,
    plan: 1,
    everSubscribed: 1,
    lsSubscriptionId: 1,
    lsSubscriptionStatus: 1,
    lsCurrentPeriodEnd: 1,
    planGrantExpiresAt: 1,
  } as const;

  return forEachBatch<RemindDoc>(filter, projection, batchSize, async (batch) => {
    const toWipe = batch.filter((ws) => !isEntitled(ws));
    for (const ws of toWipe) {
      await Workspace.updateOne(
        { _id: ws._id },
        { $set: { "publicPage.publishedAt": null, "lifecycle.wipedAt": now } }
      );
    }
    return toWipe.length;
  });
}

/**
 * Daily lapse-lifecycle sweep. Idempotent and cursor-paginated: every stage is
 * guarded by its own lifecycle timestamp, so re-running never double-sends an
 * email or double-wipes a page. `now` is injectable for tests; `batchSize`
 * defaults to 200 and is only overridden in pagination tests.
 */
export async function runBillingLifecycleSweep(
  now: Date = new Date(),
  opts: { batchSize?: number } = {}
): Promise<BillingLifecycleSweepReport> {
  await connectDB();
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;

  const preExpiryWarned = await stagePreExpiryWarn(now, batchSize);
  const lapsed = await stageLapseDetect(now, batchSize);
  const expiredNotified = await stageExpiredNotify(now, batchSize);
  const remind1Sent = await stageRemind(now, batchSize, REMIND_1_DAYS, "remind1moAt", "remind1");
  const remind2Sent = await stageRemind(now, batchSize, REMIND_2_DAYS, "remind7wkAt", "remind2");
  const wiped = await stageWipe(now, batchSize);

  console.info(
    `[billing-lifecycle-sweep] preExpiryWarned=${preExpiryWarned} lapsed=${lapsed} ` +
      `expiredNotified=${expiredNotified} remind1Sent=${remind1Sent} remind2Sent=${remind2Sent} wiped=${wiped}`
  );

  return { preExpiryWarned, lapsed, expiredNotified, remind1Sent, remind2Sent, wiped };
}

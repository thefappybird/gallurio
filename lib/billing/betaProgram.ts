import "server-only";
import { BetaProgram, Workspace } from "@/lib/db/models";
import { connectDB } from "@/lib/db/mongoose";
import { pendingGrantUpdate } from "@/lib/billing/pendingPromoGrant";

const BETA_WARNING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldShowBetaEndingWarning(
  scheduledEndAt: Date | null | undefined,
  closedAt: Date | null | undefined,
  now = new Date()
): boolean {
  return !!scheduledEndAt && !closedAt && scheduledEndAt.getTime() - now.getTime() <= BETA_WARNING_WINDOW_MS;
}

export async function getBetaProgramAnnouncement() {
  await connectDB();
  return BetaProgram.findOne({}, { scheduledEndAt: 1, closedAt: 1 }).lean();
}

export async function scheduleBetaProgramEnd(scheduledEndAt: Date, scheduledByUserId: string): Promise<void> {
  if (scheduledEndAt <= new Date()) {
    throw new Error("The beta end date must be in the future.");
  }

  const existing = await BetaProgram.findOne({}, { _id: 1, closedAt: 1 }).lean();
  if (existing?.closedAt) {
    throw new Error("The beta program is already closed.");
  }

  await BetaProgram.findOneAndUpdate(
    existing ? { _id: existing._id } : {},
    {
      $setOnInsert: { startedAt: new Date() },
      $set: { scheduledEndAt, scheduledByUserId },
    },
    { upsert: true, new: true }
  );
}

// Gate for new beta activation (onboarding + dev toggle). A missing
// BetaProgram document means the program has never been explicitly closed —
// treat that as open (false), not closed.
export async function isBetaProgramClosed(): Promise<boolean> {
  const doc = await BetaProgram.findOne({}, { closedAt: 1 }).lean();
  return !!doc?.closedAt;
}

// Idempotent operator action: closes the global beta window and flips every
// active beta workspace back to free via the existing lapse pipeline
// (lifecycle.lapsedAt) — reruns are safe because the plan:"beta" filter no
// longer matches already-flipped workspaces.
export async function closeBetaProgram(
  closedByUserId: string
): Promise<{ alreadyClosed: boolean }> {
  const doc = await BetaProgram.findOneAndUpdate(
    {},
    { $setOnInsert: { startedAt: new Date() } },
    { upsert: true, new: true }
  );

  if (doc.closedAt) {
    return { alreadyClosed: true };
  }

  await BetaProgram.updateOne(
    { _id: doc._id },
    { $set: { closedAt: new Date(), closedByUserId } }
  );

  const now = new Date();

  // Common case: no pending grant — flip straight to free via the lapse
  // pipeline, as before.
  await Workspace.updateMany(
    { plan: "beta", "pendingPromoGrant.queuedAt": null },
    { $set: { plan: "free", "lifecycle.lapsedAt": now } }
  );

  // Rare case: a still-active beta workspace redeemed a promo (e.g. beta2mo)
  // while still on plan:"beta", queuing a grant. Dumping it straight to
  // free/gated here would wipe that queued grant's effect — the same
  // no-false-expiry invariant as the webhook/sweep paths. Apply the grant
  // instead. Low volume — no .lean() needed.
  const pendingWorkspaces = await Workspace.find({
    plan: "beta",
    "pendingPromoGrant.queuedAt": { $ne: null },
  });
  for (const ws of pendingWorkspaces) {
    const grantUpdate = pendingGrantUpdate(ws.pendingPromoGrant, now);
    if (grantUpdate) {
      await Workspace.updateOne({ _id: ws._id }, { $set: grantUpdate });
    }
  }

  return { alreadyClosed: false };
}

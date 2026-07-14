import "server-only";
import { BetaProgram, Workspace } from "@/lib/db/models";

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

  await Workspace.updateMany(
    { plan: "beta" },
    { $set: { plan: "free", "lifecycle.lapsedAt": new Date() } }
  );

  return { alreadyClosed: false };
}

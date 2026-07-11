import "server-only";
import { Types } from "mongoose";
import { Workspace, type PlanTier } from "@/lib/db/models";

// Provider-agnostic plan grant: sets ONLY plan + planGrantExpiresAt, never
// touches any ls* field. Shared by the dev beta toggle and (future) promo-code
// redemption — keep generic, no dev-only or promo-specific logic here.
export async function grantPlan(
  workspaceId: string | Types.ObjectId,
  opts: { plan: PlanTier; expiresAt: Date | null }
): Promise<void> {
  await Workspace.updateOne(
    { _id: workspaceId },
    { $set: { plan: opts.plan, planGrantExpiresAt: opts.expiresAt } }
  );
}

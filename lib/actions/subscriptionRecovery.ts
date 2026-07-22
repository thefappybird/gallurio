"use server";

import mongoose from "mongoose";
import { User, Workspace } from "@/lib/db/models";
import { ownerContext, type ActionResult } from "@/lib/auth/ownerContext";
import { isWorkspaceGated } from "@/lib/billing/access";
import { grantPlan } from "@/lib/billing/grantPlan";
import { isBetaProgramClosed } from "@/lib/billing/betaProgram";

/**
 * Lets a lapsed owner join the active beta once. This intentionally supports
 * completed onboarding, while retaining the beta program's server safeguards.
 */
export async function activateBetaRecoveryAction(): Promise<ActionResult> {
  if (process.env.BETA_TESTER_ENABLED !== "true") {
    return { error: "beta_program_disabled" };
  }
  if (await isBetaProgramClosed()) return { error: "beta_program_closed" };

  const ctx = await ownerContext({ allowWhenGated: true });
  if ("error" in ctx) return ctx;

  const session = await mongoose.startSession();
  try {
    let result: ActionResult = { error: "subscription_not_gated" };
    await session.withTransaction(async () => {
      const workspace = await Workspace.findById(ctx.workspaceId).session(session);
      if (!workspace || !isWorkspaceGated(workspace)) {
        await session.abortTransaction();
        return;
      }

      // Atomic identity-level guard: a double click or another session can
      // never receive beta access more than once.
      const userUpdate = await User.updateOne(
        { workosUserId: ctx.userId, "betaParticipation.recordedAt": null },
        {
          $set: {
            "betaParticipation.recordedAt": new Date(),
            "betaParticipation.source": "recovery",
          },
        },
        { session },
      );
      if (userUpdate.modifiedCount === 0) {
        result = { error: "beta_already_activated" };
        await session.abortTransaction();
        return;
      }

      await grantPlan(workspace._id, { plan: "beta", expiresAt: null, session });
      result = { ok: true };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

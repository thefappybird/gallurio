"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, User, Team, type PlanTier } from "@/lib/db/models";
import { getAuthUser } from "@/lib/auth/session";
import { getActiveWorkspaceId, clearActiveWorkspace } from "@/lib/auth/activeWorkspace";
import { planEntitlements } from "@/lib/plans/entitlements";

export type DevPlanActionResult = {
  error?: string;
  ok?: boolean;
  // Populated when the plan change is blocked by the team-cap downgrade
  // guard so the client can render the DowngradeBlockModal with this data.
  blocked?: {
    currentTeamCount: number;
    maxTeamsOnTargetPlan: number;
    teams: { id: string; name: string; color: string; isDefault: boolean }[];
  };
};

type ActionResult = { error?: string; ok?: boolean };

// Dev-only escape hatch: flip a workspace's plan without touching Paddle.
// Useful when iterating on plan-gated UI (invoice PDFs, etc.) without round-tripping Paddle's hosted
// checkout overlay. Hard-blocked in production by the NODE_ENV gate.
//
// The team-cap downgrade guard here mirrors the Paddle webhook's: if the
// workspace currently has more teams than the target plan's cap allows,
// refuse the plan change and surface the list of teams to delete. This
// keeps the dev path forward-compatible with the eventual real Paddle
// downgrade UX.
export async function devActivatePlanAction(plan: PlanTier): Promise<DevPlanActionResult> {
  if (process.env.NODE_ENV === "production") {
    return { error: "Not available in production" };
  }

  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  await connectDB();

  const user = await User.findOne(
    { workosUserId: authUser.workosUserId },
    { memberships: 1 }
  ).lean();
  const ownerMembership = user?.memberships.find((m) => m.role === "owner");
  if (!ownerMembership) return { error: "No active workspace" };

  const workspaceId = await getActiveWorkspaceId(user!.memberships);
  if (!workspaceId) return { error: "No active workspace" };

  const workspace = await Workspace.findById(workspaceId)
    .select({ _id: 1, plan: 1 })
    .lean();
  if (!workspace) return { error: "Workspace not found" };

  // Block downgrades that would leave the workspace over-cap.
  const newEntitlements = planEntitlements(plan);
  const currentTeamCount = await Team.countDocuments({ workspaceId: workspace._id });
  if (currentTeamCount > newEntitlements.maxTeams) {
    const teams = await Team.find({ workspaceId: workspace._id })
      .sort({ isDefault: -1, createdAt: 1 })
      .select({ _id: 1, name: 1, color: 1, isDefault: 1 })
      .lean();
    return {
      error: "TEAM_DOWNGRADE_BLOCKED",
      blocked: {
        currentTeamCount,
        maxTeamsOnTargetPlan: newEntitlements.maxTeams,
        teams: teams.map((t) => ({
          id: String(t._id),
          name: t.name,
          color: t.color,
          isDefault: t.isDefault ?? false,
        })),
      },
    };
  }

  // Simulate a complete active subscription so every billing-dependent surface
  // (settings billing panel, plan gates, "manage subscription") behaves exactly
  // as it would with a real Paddle subscription — no Paddle credentials needed.
  const isPaid = plan !== "free";
  await Workspace.updateOne(
    { _id: workspace._id },
    {
      $set: {
        plan,
        paddleSubscriptionStatus: isPaid ? "active" : null,
        paddleCurrentPeriodEnd: isPaid
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : null,
        paddleSubscriptionId: isPaid ? `dev_sub_${workspace._id}` : null,
        paddleCustomerId: isPaid ? `dev_cus_${workspace._id}` : null,
      },
    }
  );

  await User.updateOne(
    { workosUserId: authUser.workosUserId },
    { $set: { onboardingStep: "done" } }
  );

  revalidatePath("/onboarding/done");
  revalidatePath("/settings", "layout");
  return { ok: true };
}

// Dev-only reset: wipe the current user's workspace + memberships + teams so
// onboarding can be re-run from scratch. Replaces the old Clerk-org deletion
// path. Hard-blocked in production by the NODE_ENV gate.
export async function devResetWorkspaceAction(): Promise<ActionResult> {
  if (process.env.NODE_ENV === "production") {
    return { error: "Not available in production" };
  }

  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  await connectDB();

  const user = await User.findOne(
    { workosUserId: authUser.workosUserId },
    { memberships: 1 }
  ).lean();
  if (!user) return { ok: true };

  const ownedMembership = user.memberships.find((m) => m.role === "owner");
  if (ownedMembership) {
    const wsId = ownedMembership.workspaceId;
    await Promise.all([
      Workspace.deleteOne({ _id: wsId }),
      Team.deleteMany({ workspaceId: wsId }),
    ]);
  }

  await User.updateOne(
    { workosUserId: authUser.workosUserId },
    {
      $set: { memberships: [], onboardingStep: "business", onboardingCompletedAt: null },
    }
  );

  await clearActiveWorkspace();
  return { ok: true };
}

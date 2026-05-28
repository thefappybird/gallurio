"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, User, Team, type PlanTier } from "@/lib/db/models";
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

// Dev-only escape hatch: flip a workspace's plan without touching HitPay.
// Useful when iterating on plan-gated UI (custom-domain unlocks, branding
// removal, invoice PDFs, etc.) without round-tripping HitPay's hosted
// authorization page. Hard-blocked in production by the NODE_ENV gate.
//
// The team-cap downgrade guard here mirrors the HitPay webhook's: if the
// workspace currently has more teams than the target plan's cap allows,
// refuse the plan change and surface the list of teams to delete. This
// keeps the dev path forward-compatible with the eventual real HitPay
// downgrade UX.
export async function devActivatePlanAction(plan: PlanTier): Promise<DevPlanActionResult> {
  if (process.env.NODE_ENV === "production") {
    return { error: "Not available in production" };
  }

  const session = await auth();
  if (!session.userId) return { error: "Not authenticated" };
  if (!session.orgId) return { error: "No active workspace" };

  await connectDB();
  const workspace = await Workspace.findOne({ clerkOrgId: session.orgId })
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

  await Workspace.updateOne(
    { clerkOrgId: session.orgId },
    {
      $set: {
        plan,
        hitpayRecurringStatus: plan === "free" ? null : "active",
        hitpayCurrentPeriodEnd:
          plan === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }
  );

  await User.updateOne(
    { clerkUserId: session.userId },
    { $set: { onboardingStep: "done" } }
  );

  revalidatePath("/onboarding/done");
  revalidatePath("/settings", "layout");
  return { ok: true };
}

// Dev-only invite shortcut: fires a Clerk organization invitation directly,
// skipping the seat-reservation + PendingTeamAssignment plumbing. Useful when
// iterating on member-side UI (sidebar filtering, /bookings as a member,
// proxy redirects) without round-tripping the full invite flow. Hard-blocked
// in production by the NODE_ENV gate. Real invites must go through
// inviteMemberAction in app/.../settings/teams/_invite-action.ts.
export async function devSeedMemberAction(email: string): Promise<ActionResult> {
  if (process.env.NODE_ENV === "production") {
    return { error: "Not available in production" };
  }
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    return { error: "Enter a valid email address" };
  }

  const session = await auth();
  if (!session.userId) return { error: "Not authenticated" };
  if (!session.orgId) return { error: "No active workspace" };

  try {
    const clerk = await clerkClient();
    await clerk.organizations.createOrganizationInvitation({
      organizationId: session.orgId,
      emailAddress: trimmed,
      role: "org:member",
      inviterUserId: session.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invite failed";
    return { error: message };
  }

  return { ok: true };
}

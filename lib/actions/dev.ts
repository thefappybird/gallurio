"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, User, type PlanTier } from "@/lib/db/models";

type ActionResult = { error?: string; ok?: boolean };

// Dev-only escape hatch: flip a workspace's plan without touching HitPay.
// Useful when iterating on plan-gated UI (custom-domain unlocks, branding
// removal, invoice PDFs, etc.) without round-tripping HitPay's hosted
// authorization page. Hard-blocked in production by the NODE_ENV gate.
export async function devActivatePlanAction(plan: PlanTier): Promise<ActionResult> {
  if (process.env.NODE_ENV === "production") {
    return { error: "Not available in production" };
  }

  const session = await auth();
  if (!session.userId) return { error: "Not authenticated" };
  if (!session.orgId) return { error: "No active workspace" };

  await connectDB();
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

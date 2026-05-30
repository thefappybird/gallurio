"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { ownerContext, type ActionResult } from "@/lib/auth/ownerContext";
import {
  assertCanAddTeamMember,
  releaseTeamSeat,
  TeamSeatCapExceededError,
  TeamNotFoundError,
} from "@/lib/auth/assertCanAddTeamMember";
import { Team } from "@/lib/db/models/team";
import { TeamMembership } from "@/lib/db/models/teamMembership";
import { User } from "@/lib/db/models/User";
import {
  assignMemberToTeamSchema,
  removeMemberFromTeamSchema,
  setLeadFlagSchema,
  removeMemberFromWorkspaceSchema,
  type AssignMemberToTeamInput,
  type RemoveMemberFromTeamInput,
  type SetLeadFlagInput,
  type RemoveMemberFromWorkspaceInput,
} from "@/lib/validators/team";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

export async function assignMemberToTeamAction(
  input: AssignMemberToTeamInput,
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = assignMemberToTeamSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const { clerkUserId, teamId, role } = parsed.data;
  const teamObjectId = toObjectId(teamId);
  if (!teamObjectId) return { error: "Invalid team id" };

  const team = await Team.findOne({
    _id: teamObjectId,
    workspaceId: ctx.workspace._id,
  })
    .select({ _id: 1 })
    .lean();
  if (!team) return { error: "TEAM_NOT_FOUND" };

  // Verify the clerkUserId belongs to THIS workspace. The UI only surfaces
  // real members, but a direct server-action call could otherwise consume
  // team seats for an arbitrary Clerk user. The Clerk webhook keeps
  // User.memberships in sync with org membership, so this query is the
  // authoritative check.
  const userInWorkspace = await User.findOne({
    clerkUserId,
    "memberships.workspaceId": ctx.workspace._id,
  })
    .select({ _id: 1 })
    .lean();
  if (!userInWorkspace) return { error: "USER_NOT_IN_WORKSPACE" };

  const existing = await TeamMembership.findOne({
    teamId: teamObjectId,
    clerkUserId,
  })
    .select({ _id: 1 })
    .lean();
  if (existing) return { error: "ALREADY_ON_TEAM" };

  try {
    await assertCanAddTeamMember(teamObjectId, ctx.workspace.plan, ctx.workspace._id);
  } catch (err) {
    if (err instanceof TeamSeatCapExceededError) {
      return { error: "TEAM_SEAT_CAP_EXCEEDED" };
    }
    if (err instanceof TeamNotFoundError) {
      return { error: "TEAM_NOT_FOUND" };
    }
    throw err;
  }

  try {
    await TeamMembership.create({
      workspaceId: ctx.workspace._id,
      teamId: teamObjectId,
      clerkUserId,
      role,
    });
  } catch (err) {
    await releaseTeamSeat(teamObjectId, ctx.workspace._id);
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: unknown }).code === 11000
    ) {
      return { error: "ALREADY_ON_TEAM" };
    }
    throw err;
  }

  revalidatePath("/[locale]/teams", "page");
  return { ok: true };
}

export async function removeMemberFromTeamAction(
  input: RemoveMemberFromTeamInput,
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = removeMemberFromTeamSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const { clerkUserId, teamId } = parsed.data;
  const teamObjectId = toObjectId(teamId);
  if (!teamObjectId) return { error: "Invalid team id" };

  const result = await TeamMembership.deleteOne({
    workspaceId: ctx.workspace._id,
    teamId: teamObjectId,
    clerkUserId,
  });

  if (result.deletedCount === 0) return { error: "MEMBERSHIP_NOT_FOUND" };

  await releaseTeamSeat(teamObjectId, ctx.workspace._id);

  revalidatePath("/[locale]/teams", "page");
  return { ok: true };
}

export async function setLeadFlagAction(
  input: SetLeadFlagInput,
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = setLeadFlagSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const { clerkUserId, teamId, isLead } = parsed.data;
  const teamObjectId = toObjectId(teamId);
  if (!teamObjectId) return { error: "Invalid team id" };

  const updated = await TeamMembership.findOneAndUpdate(
    { workspaceId: ctx.workspace._id, teamId: teamObjectId, clerkUserId },
    { $set: { role: isLead ? "lead" : "member" } },
    { new: true },
  )
    .select({ _id: 1 })
    .lean();
  if (!updated) return { error: "MEMBERSHIP_NOT_FOUND" };

  revalidatePath("/[locale]/teams", "page");
  return { ok: true };
}

// Retained intentionally: workspace-level member removal (vs. the per-team
// removal the Details drawer exposes) has no UI yet — it belongs to the
// deferred members page. Kept here so that page can wire to a tested,
// owner-gated action rather than re-implementing the Clerk org-membership +
// seat-release cascade. See docs/RELEASE-CHECKLIST.md.
export async function removeMemberFromWorkspaceAction(
  input: RemoveMemberFromWorkspaceInput,
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = removeMemberFromWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const { clerkUserId } = parsed.data;

  if (clerkUserId === ctx.workspace.ownerUserId) {
    return { error: "CANNOT_REMOVE_OWNER" };
  }

  const memberships = await TeamMembership.find({
    workspaceId: ctx.workspace._id,
    clerkUserId,
  })
    .select({ teamId: 1 })
    .lean();

  try {
    const clerk = await clerkClient();
    await clerk.organizations.deleteOrganizationMembership({
      organizationId: ctx.clerkOrgId,
      userId: clerkUserId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to remove member";
    return { error: msg };
  }

  await TeamMembership.deleteMany({
    workspaceId: ctx.workspace._id,
    clerkUserId,
  });

  for (const m of memberships) {
    await releaseTeamSeat(m.teamId, ctx.workspace._id);
  }

  revalidatePath("/[locale]/teams", "page");
  return { ok: true };
}

"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
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
import { connectDB } from "@/lib/db/mongoose";
import { sendNotification } from "@/lib/notifications/send";
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
  const { workosUserId, teamId, role } = parsed.data;
  const teamObjectId = toObjectId(teamId);
  if (!teamObjectId) return { error: "Invalid team id" };

  const team = await Team.findOne({
    _id: teamObjectId,
    workspaceId: ctx.workspace._id,
  })
    .select({ _id: 1 })
    .lean();
  if (!team) return { error: "TEAM_NOT_FOUND" };

  // Verify the workosUserId belongs to THIS workspace. The UI only surfaces
  // real members, but a direct server-action call could otherwise consume
  // team seats for an arbitrary user. User.memberships is the authoritative
  // source of workspace access.
  const userInWorkspace = await User.findOne({
    workosUserId,
    "memberships.workspaceId": ctx.workspace._id,
  })
    .select({ _id: 1 })
    .lean();
  if (!userInWorkspace) return { error: "USER_NOT_IN_WORKSPACE" };

  const existing = await TeamMembership.findOne({
    teamId: teamObjectId,
    workosUserId,
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
      workosUserId,
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
  const { workosUserId, teamId } = parsed.data;
  const teamObjectId = toObjectId(teamId);
  if (!teamObjectId) return { error: "Invalid team id" };

  const team = await Team.findOne(
    { _id: teamObjectId, workspaceId: ctx.workspace._id },
    { _id: 1, name: 1 },
  ).lean();
  if (!team) return { error: "TEAM_NOT_FOUND" };

  const result = await TeamMembership.deleteOne({
    workspaceId: ctx.workspace._id,
    teamId: teamObjectId,
    workosUserId,
  });

  if (result.deletedCount === 0) return { error: "MEMBERSHIP_NOT_FOUND" };

  await releaseTeamSeat(teamObjectId, ctx.workspace._id);

  const removedUser = await User.findOne(
    { workosUserId },
    { workosUserId: 1, email: 1, name: 1 },
  ).lean();
  if (removedUser) {
    const locale = await getLocale();
    // Non-fatal: removal already committed; don't surface a notification failure to the caller.
    await sendNotification({
      workspaceId: ctx.workspaceId,
      recipients: [{
        workosUserId: removedUser.workosUserId,
        email: removedUser.email,
        name: removedUser.name || undefined,
      }],
      type: "team.removed",
      entityId: String(team._id),
      entityType: "team",
      triggeredByWorkosUserId: ctx.userId,
      locale,
      vars: { teamName: team.name },
    }).catch((err) => {
      console.error("[teams] sendNotification (team.removed) failed:", err);
    });
  }

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
  const { workosUserId, teamId, isLead } = parsed.data;
  const teamObjectId = toObjectId(teamId);
  if (!teamObjectId) return { error: "Invalid team id" };

  // A team can have at most one lead. Reject promotion when another member is
  // already the lead (mirrors the invite-flow enforcement). Demotion is always
  // allowed, and re-promoting the same member is a no-op that stays valid.
  if (isLead) {
    const existingLead = await TeamMembership.findOne({
      workspaceId: ctx.workspace._id,
      teamId: teamObjectId,
      role: "lead",
      workosUserId: { $ne: workosUserId },
    })
      .select({ _id: 1 })
      .lean();
    if (existingLead) return { error: "TEAM_ALREADY_HAS_LEAD" };
  }

  const updated = await TeamMembership.findOneAndUpdate(
    { workspaceId: ctx.workspace._id, teamId: teamObjectId, workosUserId },
    { $set: { role: isLead ? "lead" : "member" } },
    { new: true },
  )
    .select({ _id: 1 })
    .lean();
  if (!updated) return { error: "MEMBERSHIP_NOT_FOUND" };

  revalidatePath("/[locale]/teams", "page");
  return { ok: true };
}

export type RemoveMemberFromWorkspaceResult = ActionResult & {
  teamName?: string;
};

// Workspace-level member removal. Removes workspace membership, all team
// memberships, and releases the occupied team seats — in a single transaction.
export async function removeMemberFromWorkspaceAction(
  input: RemoveMemberFromWorkspaceInput,
): Promise<RemoveMemberFromWorkspaceResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = removeMemberFromWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const { workosUserId } = parsed.data;

  if (workosUserId === ctx.workspace.ownerUserId) {
    return { error: "CANNOT_REMOVE_OWNER" };
  }

  const leadMembership = await TeamMembership.findOne({
    workspaceId: ctx.workspace._id,
    workosUserId,
    role: "lead",
  })
    .select({ teamId: 1 })
    .lean();
  if (leadMembership) {
    const team = await Team.findOne({ _id: leadMembership.teamId })
      .select({ name: 1 })
      .lean();
    return { error: "IS_TEAM_LEAD", teamName: team?.name };
  }

  const memberships = await TeamMembership.find({
    workspaceId: ctx.workspace._id,
    workosUserId,
  })
    .select({ teamId: 1 })
    .lean();

  await connectDB();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Remove workspace membership from User.
      await User.updateOne(
        { workosUserId },
        { $pull: { memberships: { workspaceId: ctx.workspace._id } } },
        { session },
      );

      // Delete all team memberships for this user in this workspace.
      await TeamMembership.deleteMany(
        { workspaceId: ctx.workspace._id, workosUserId },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  // Release team seats outside the transaction (idempotent decrements).
  await Promise.all(
    memberships.map((m) => releaseTeamSeat(m.teamId, ctx.workspace._id)),
  );

  revalidatePath("/[locale]/teams", "page");
  return { ok: true };
}

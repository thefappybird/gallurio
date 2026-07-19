"use server";

import mongoose from "mongoose";
import { z } from "zod";
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
import { ActivityLog } from "@/lib/db/models/ActivityLog";
import { connectDB } from "@/lib/db/mongoose";
import { sendNotification } from "@/lib/notifications/send";
import {
  assignMemberToTeamSchema,
  removeMemberFromTeamSchema,
  removeMemberFromTeamAndWorkspaceSchema,
  setLeadFlagSchema,
  removeMemberFromWorkspaceSchema,
  type AssignMemberToTeamInput,
  type RemoveMemberFromTeamInput,
  type RemoveMemberFromTeamAndWorkspaceInput,
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

const memberActivitySchema = z.object({
  workosUserId: z.string().min(1),
  cursor: z.string().datetime().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  action: z.enum(["created", "updated", "deleted", "status_changed", "client_changed", "payment_added", "payment_updated"]).optional(),
});

export async function getMemberActivityAction(input: unknown) {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = memberActivitySchema.safeParse(input);
  if (!parsed.success) return { error: "INVALID_INPUT" };

  const { workosUserId, cursor, from, to, action } = parsed.data;
  const member = await User.exists({
    workosUserId,
    "memberships.workspaceId": ctx.workspace._id,
  });
  if (!member) return { error: "USER_NOT_IN_WORKSPACE" };

  const createdAt: { $gte?: Date; $lte?: Date; $lt?: Date } = {};
  if (from) createdAt.$gte = new Date(from);
  if (to) createdAt.$lte = new Date(to);
  if (cursor) createdAt.$lt = new Date(cursor);
  const logs = await ActivityLog.find({
    workspaceId: ctx.workspace._id,
    actorUserId: workosUserId,
    ...(action ? { action } : {}),
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(21)
    .select({ entity: 1, action: 1, createdAt: 1 })
    .lean();
  const hasMore = logs.length > 20;
  const items = logs.slice(0, 20).map((log) => ({
    id: String(log._id),
    entity: log.entity,
    action: log.action,
    createdAt: log.createdAt.toISOString(),
  }));
  return { items, nextCursor: hasMore ? items.at(-1)?.createdAt ?? null : null };
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

  const membership = await TeamMembership.findOne({
    workspaceId: ctx.workspace._id,
    teamId: teamObjectId,
    workosUserId,
  })
    .select({ role: 1 })
    .lean();
  if (!membership) return { error: "MEMBERSHIP_NOT_FOUND" };
  if (membership.role === "lead") return { error: "IS_TEAM_LEAD" };

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

// Removes a member from their only team and the workspace as one tenant-scoped
// transaction. The UI disables this action when other team memberships exist;
// this server-side guard keeps that invariant true for direct action calls too.
export async function removeMemberFromTeamAndWorkspaceAction(
  input: RemoveMemberFromTeamAndWorkspaceInput,
): Promise<RemoveMemberFromWorkspaceResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = removeMemberFromTeamAndWorkspaceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  const { workosUserId, teamId } = parsed.data;
  const teamObjectId = toObjectId(teamId);
  if (!teamObjectId) return { error: "Invalid team id" };
  if (workosUserId === ctx.workspace.ownerUserId) return { error: "CANNOT_REMOVE_OWNER" };

  const memberships = await TeamMembership.find({
    workspaceId: ctx.workspace._id,
    workosUserId,
  }).select({ teamId: 1, role: 1 }).lean();
  const current = memberships.find((membership) => String(membership.teamId) === String(teamObjectId));
  if (!current) return { error: "MEMBERSHIP_NOT_FOUND" };
  if (current.role === "lead") {
    const team = await Team.findOne({ _id: teamObjectId, workspaceId: ctx.workspace._id })
      .select({ name: 1 }).lean();
    return { error: "IS_TEAM_LEAD", teamName: team?.name };
  }
  if (memberships.length !== 1) return { error: "MEMBER_ON_OTHER_TEAMS" };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await User.updateOne(
        { workosUserId },
        { $pull: { memberships: { workspaceId: ctx.workspace._id } } },
        { session },
      );
      const deleted = await TeamMembership.deleteOne(
        { workspaceId: ctx.workspace._id, teamId: teamObjectId, workosUserId, role: "member" },
        { session },
      );
      if (deleted.deletedCount !== 1) throw new Error("MEMBERSHIP_NOT_FOUND");
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBERSHIP_NOT_FOUND") {
      return { error: "MEMBERSHIP_NOT_FOUND" };
    }
    throw error;
  } finally {
    await session.endSession();
  }
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
  const { workosUserId, teamId, isLead } = parsed.data;
  const teamObjectId = toObjectId(teamId);
  if (!teamObjectId) return { error: "Invalid team id" };

  // Promote by atomically transferring the sole lead role. The selected member
  // becomes lead and any prior lead is demoted in the same transaction.
  if (isLead) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await TeamMembership.updateMany(
          { workspaceId: ctx.workspace._id, teamId: teamObjectId, role: "lead", workosUserId: { $ne: workosUserId } },
          { $set: { role: "member" } },
          { session },
        );
        const promoted = await TeamMembership.findOneAndUpdate(
          { workspaceId: ctx.workspace._id, teamId: teamObjectId, workosUserId },
          { $set: { role: "lead" } },
          { new: true, session },
        ).select({ _id: 1 }).lean();
        if (!promoted) throw new Error("MEMBERSHIP_NOT_FOUND");
      });
    } catch (error) {
      if (error instanceof Error && error.message === "MEMBERSHIP_NOT_FOUND") {
        return { error: "MEMBERSHIP_NOT_FOUND" };
      }
      throw error;
    } finally {
      await session.endSession();
    }
    revalidatePath("/[locale]/teams", "page");
    return { ok: true };
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

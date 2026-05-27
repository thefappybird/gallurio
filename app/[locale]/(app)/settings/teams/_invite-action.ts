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
import { PendingTeamAssignment } from "@/lib/db/models/pendingTeamAssignment";
import {
  inviteMemberSchema,
  revokeInviteSchema,
  type InviteMemberInput,
  type RevokeInviteInput,
} from "@/lib/validators/team";

export type InviteMemberResult = ActionResult & {
  fullTeamNames?: string[];
  unknownTeamIds?: string[];
};

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

export async function inviteMemberAction(
  input: InviteMemberInput,
): Promise<InviteMemberResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const { email, teamIds, leadOnTeamIds } = parsed.data;

  const teamObjectIds = teamIds.map(toObjectId);
  if (teamObjectIds.some((id) => id === null)) {
    return { error: "Invalid team id" };
  }

  const validIds = teamObjectIds.filter(
    (id): id is mongoose.Types.ObjectId => id !== null,
  );

  const teams = await Team.find({
    _id: { $in: validIds },
    workspaceId: ctx.workspace._id,
  })
    .select({ _id: 1, name: 1 })
    .lean();
  if (teams.length !== validIds.length) {
    const found = new Set(teams.map((t) => String(t._id)));
    const missing = teamIds.filter((id) => !found.has(id));
    return { error: "TEAM_NOT_FOUND", unknownTeamIds: missing };
  }

  const reserved: mongoose.Types.ObjectId[] = [];
  const fullTeamNames: string[] = [];
  for (const teamId of validIds) {
    try {
      await assertCanAddTeamMember(teamId, ctx.workspace.plan);
      reserved.push(teamId);
    } catch (err) {
      if (err instanceof TeamSeatCapExceededError) {
        const team = teams.find((t) => String(t._id) === String(teamId));
        if (team) fullTeamNames.push(team.name);
      } else if (err instanceof TeamNotFoundError) {
        // Race: deleted between fetch and assert.
      } else {
        for (const id of reserved) await releaseTeamSeat(id);
        throw err;
      }
    }
  }

  if (fullTeamNames.length > 0) {
    for (const id of reserved) await releaseTeamSeat(id);
    return { error: "TEAM_SEAT_CAP_EXCEEDED", fullTeamNames };
  }

  let invitationId: string | null = null;
  try {
    const clerk = await clerkClient();
    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId: ctx.clerkOrgId,
      emailAddress: email,
      role: "org:member",
      inviterUserId: ctx.userId,
    });
    invitationId = invitation.id;
  } catch (err) {
    for (const id of reserved) await releaseTeamSeat(id);
    const msg = err instanceof Error ? err.message : "Failed to send invite";
    if (msg.toLowerCase().includes("already")) {
      return { error: "ALREADY_INVITED_OR_MEMBER" };
    }
    return { error: msg };
  }

  try {
    await PendingTeamAssignment.findOneAndUpdate(
      { workspaceId: ctx.workspace._id, email },
      {
        $set: {
          workspaceId: ctx.workspace._id,
          email,
          teamIds: validIds,
          leadOnTeamIds: leadOnTeamIds
            .map(toObjectId)
            .filter((id): id is mongoose.Types.ObjectId => id !== null),
          clerkInvitationId: invitationId,
          invitedByClerkUserId: ctx.userId,
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
  } catch (err) {
    for (const id of reserved) await releaseTeamSeat(id);
    throw err;
  }

  revalidatePath("/settings/teams", "page");
  return { ok: true };
}

export async function revokeInviteAction(
  input: RevokeInviteInput,
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = revokeInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const { email } = parsed.data;

  const pending = await PendingTeamAssignment.findOne({
    workspaceId: ctx.workspace._id,
    email,
  }).lean();
  if (!pending) return { error: "INVITE_NOT_FOUND" };

  if (pending.clerkInvitationId) {
    try {
      const clerk = await clerkClient();
      await clerk.organizations.revokeOrganizationInvitation({
        organizationId: ctx.clerkOrgId,
        invitationId: pending.clerkInvitationId,
        requestingUserId: ctx.userId,
      });
    } catch (err) {
      // Clerk may have already expired the invitation — release seats anyway.
      console.warn("[revokeInviteAction] Clerk revoke failed", err);
    }
  }

  for (const teamId of pending.teamIds ?? []) {
    await releaseTeamSeat(teamId);
  }

  await PendingTeamAssignment.deleteOne({ _id: pending._id });

  revalidatePath("/settings/teams", "page");
  return { ok: true };
}

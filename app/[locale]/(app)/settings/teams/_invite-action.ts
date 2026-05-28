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
import { claimAndReleasePendingInvite } from "@/lib/db/jobs/release-pending-invite-seats";
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

  // Re-invite over an existing pending invite: release the prior reservation
  // before reserving new seats. Without this, the upsert below would silently
  // overwrite `teamIds`, orphaning the old seats — they'd stay reserved on
  // Team.memberCount forever (no row to revoke or expire through). Also
  // revoke the prior Clerk invite so the user can't accept an invite for
  // teams they're no longer being added to.
  const existingPending = await PendingTeamAssignment.findOne({
    workspaceId: ctx.workspace._id,
    email,
  })
    .select({ _id: 1, clerkInvitationId: 1 })
    .lean();
  if (existingPending) {
    if (existingPending.clerkInvitationId) {
      try {
        const clerk = await clerkClient();
        await clerk.organizations.revokeOrganizationInvitation({
          organizationId: ctx.clerkOrgId,
          invitationId: existingPending.clerkInvitationId,
          requestingUserId: ctx.userId,
        });
      } catch (err) {
        console.warn(
          "[inviteMemberAction] failed to revoke prior Clerk invitation",
          err,
        );
      }
    }
    const outcome = await claimAndReleasePendingInvite(existingPending._id);
    if (outcome.status === "claimed-for-accept") {
      // The user is currently accepting the prior invite via the webhook —
      // refuse this new invite so we don't double-allocate seats.
      return { error: "INVITE_IN_PROGRESS" };
    }
  }

  const reserved: mongoose.Types.ObjectId[] = [];
  const fullTeamNames: string[] = [];
  for (const teamId of validIds) {
    try {
      await assertCanAddTeamMember(teamId, ctx.workspace.plan, ctx.workspace._id);
      reserved.push(teamId);
    } catch (err) {
      if (err instanceof TeamSeatCapExceededError) {
        const team = teams.find((t) => String(t._id) === String(teamId));
        if (team) fullTeamNames.push(team.name);
      } else if (err instanceof TeamNotFoundError) {
        // Race: deleted between fetch and assert.
      } else {
        for (const id of reserved) await releaseTeamSeat(id, ctx.workspace._id);
        throw err;
      }
    }
  }

  if (fullTeamNames.length > 0) {
    for (const id of reserved) await releaseTeamSeat(id, ctx.workspace._id);
    return { error: "TEAM_SEAT_CAP_EXCEEDED", fullTeamNames };
  }

  // Order matters: persist the pending row BEFORE issuing the Clerk invite.
  // If we sent the invite first and the pending write failed, the user could
  // accept their invite and join the org with no PendingTeamAssignment for
  // the webhook to drain — they'd be a member with zero TeamMembership rows.
  // Writing the pending row first means a downstream Clerk failure can be
  // rolled back cleanly: delete the pending row + release seats.
  let pendingId: mongoose.Types.ObjectId;
  try {
    const pending = await PendingTeamAssignment.findOneAndUpdate(
      { workspaceId: ctx.workspace._id, email },
      {
        $set: {
          workspaceId: ctx.workspace._id,
          email,
          teamIds: validIds,
          leadOnTeamIds: leadOnTeamIds
            .map(toObjectId)
            .filter((id): id is mongoose.Types.ObjectId => id !== null),
          clerkInvitationId: null,
          invitedByClerkUserId: ctx.userId,
          createdAt: new Date(),
          claimedFor: null,
          claimedAt: null,
        },
      },
      { upsert: true, new: true },
    )
      .select({ _id: 1 })
      .lean();
    if (!pending) throw new Error("Failed to persist pending assignment");
    pendingId = pending._id;
  } catch (err) {
    for (const id of reserved) await releaseTeamSeat(id, ctx.workspace._id);
    throw err;
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
    // Clerk rejected the invite. Release reserved seats and delete the
    // pending row through the idempotent helper so seat accounting stays
    // honest even under a concurrent revoke/cron race.
    await claimAndReleasePendingInvite(pendingId);
    const msg = err instanceof Error ? err.message : "Failed to send invite";
    if (msg.toLowerCase().includes("already")) {
      return { error: "ALREADY_INVITED_OR_MEMBER" };
    }
    return { error: msg };
  }

  await PendingTeamAssignment.updateOne(
    { _id: pendingId },
    { $set: { clerkInvitationId: invitationId } },
  );

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
  })
    .select({ _id: 1, clerkInvitationId: 1, releasedAt: 1 })
    .lean();
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
      // Clerk may have already expired the invitation — proceed to release
      // seats anyway via the idempotent helper.
      console.warn("[revokeInviteAction] Clerk revoke failed", err);
    }
  }

  const outcome = await claimAndReleasePendingInvite(pending._id);
  if (outcome.status === "not-found") {
    // The row was deleted between our findOne and the claim — likely by the
    // cleanup cron. Seats were already refunded; nothing more to do.
  }

  revalidatePath("/settings/teams", "page");
  return { ok: true };
}

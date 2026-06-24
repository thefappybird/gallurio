"use server";

import crypto from "crypto";
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
import { User } from "@/lib/db/models/User";
import { Invitation } from "@/lib/db/models/Invitation";
import { TeamMembership } from "@/lib/db/models/teamMembership";
import { sendTeamInviteEmail } from "@/lib/email/teamInvite";
import { resolveWorkspaceBrand } from "@/lib/email/brand";
import { emailLocale } from "@/lib/email/messages";
import { sendNotification } from "@/lib/notifications/send";
import {
  inviteMemberSchema,
  revokeInviteSchema,
  type InviteMemberInput,
  type RevokeInviteInput,
} from "@/lib/validators/team";

export type InviteMemberResult = ActionResult & {
  fullTeamNames?: string[];
  leadTakenTeamNames?: string[];
  unknownTeamIds?: string[];
};

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

function sha256Hex(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

function generateInviteToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: sha256Hex(raw) };
}

async function releaseInvitationSeats(
  teamIds: mongoose.Types.ObjectId[],
  workspaceId: mongoose.Types.ObjectId,
): Promise<void> {
  await Promise.all(teamIds.map((id) => releaseTeamSeat(id, workspaceId)));
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

  // Re-invite over an existing pending invite: revoke first, release seats, then
  // proceed to create a fresh invite. Idempotent — if already revoked, skip.
  const existingPending = await Invitation.findOne({
    workspaceId: ctx.workspace._id,
    email,
    status: "pending",
  })
    .select({ _id: 1, teamIds: 1 })
    .lean();

  if (existingPending) {
    await Invitation.updateOne(
      { _id: existingPending._id, workspaceId: ctx.workspace._id },
      { $set: { status: "revoked", revokedAt: new Date() } },
    );
    await releaseInvitationSeats(
      (existingPending.teamIds ?? []) as mongoose.Types.ObjectId[],
      ctx.workspace._id,
    );
  }

  // Reserve seats for all requested teams. Roll back on partial failure.
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
        await releaseInvitationSeats(reserved, ctx.workspace._id);
        throw err;
      }
    }
  }

  if (fullTeamNames.length > 0) {
    await releaseInvitationSeats(reserved, ctx.workspace._id);
    return { error: "TEAM_SEAT_CAP_EXCEEDED", fullTeamNames };
  }

  const leadObjectIds = leadOnTeamIds
    .map(toObjectId)
    .filter((id): id is mongoose.Types.ObjectId => id !== null);

  if (leadObjectIds.length > 0) {
    const [leadMemberships, pendingLeadInvites] = await Promise.all([
      TeamMembership.find({
        workspaceId: ctx.workspace._id,
        teamId: { $in: leadObjectIds },
        role: "lead",
      })
        .select({ teamId: 1 })
        .lean(),
      Invitation.find({
        workspaceId: ctx.workspace._id,
        status: "pending",
        leadOnTeamIds: { $in: leadObjectIds },
      })
        .select({ leadOnTeamIds: 1 })
        .lean(),
    ]);

    const takenLeadIds = new Set<string>(
      leadMemberships.map((membership) => String(membership.teamId)),
    );
    for (const invite of pendingLeadInvites) {
      for (const teamId of invite.leadOnTeamIds ?? []) {
        takenLeadIds.add(String(teamId));
      }
    }

    if (takenLeadIds.size > 0) {
      await releaseInvitationSeats(reserved, ctx.workspace._id);
      return {
        error: "TEAM_ALREADY_HAS_LEAD",
        leadTakenTeamNames: teams
          .filter((team) => takenLeadIds.has(String(team._id)))
          .map((team) => team.name),
      };
    }
  }

  const { raw, hash } = generateInviteToken();

  let invitationId: mongoose.Types.ObjectId;
  try {
    const invitation = await Invitation.create({
      workspaceId: ctx.workspace._id,
      email,
      role: "staff",
      teamIds: validIds,
      leadOnTeamIds: leadObjectIds,
      tokenHash: hash,
      invitedByWorkosUserId: ctx.userId,
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    invitationId = invitation._id;
  } catch (err) {
    await releaseInvitationSeats(reserved, ctx.workspace._id);
    throw err;
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const acceptUrl = `${appUrl}/invite/accept?token=${encodeURIComponent(raw)}`;

  const wsCountry = ((ctx.workspace as Record<string, unknown>).country as string | undefined) ?? "";
  const wsName = ((ctx.workspace as Record<string, unknown>).name as string | undefined) ?? "Gallurio workspace";
  const inviteLocale = emailLocale(wsCountry);
  const workspaceBrand = resolveWorkspaceBrand(ctx.workspace as Parameters<typeof resolveWorkspaceBrand>[0]);

  const invitingUser = await User.findOne(
    { workosUserId: ctx.userId },
    { name: 1 },
  ).lean();
  const inviterName = invitingUser?.name || wsName;

  const emailResult = await sendTeamInviteEmail({
    to: email,
    inviterName,
    workspaceName: wsName,
    teamNames: teams.map((t) => t.name),
    acceptUrl,
    locale: inviteLocale,
    brand: workspaceBrand,
  });

  if (!emailResult.ok) {
    // Email delivery failed — revoke the token so a never-received link can
    // never be exploited, and release the reserved seats.
    await Invitation.updateOne(
      { _id: invitationId },
      { $set: { status: "revoked", revokedAt: new Date() } },
    );
    await releaseInvitationSeats(reserved, ctx.workspace._id);
    return { error: "EMAIL_SEND_FAILED" };
  }

  // Notify the invited user if they already have an account.
  const invitedUser = await User.findOne(
    { email },
    { workosUserId: 1, email: 1, name: 1 },
  ).lean();
  if (invitedUser) {
    const locale = await getLocale();
    const wsName = (ctx.workspace as Record<string, unknown>).name as string | undefined;
    for (const team of teams) {
      // Non-fatal: invite already committed; don't surface a notification failure to the caller.
      await sendNotification({
        workspaceId: ctx.workspaceId,
        recipients: [{
          workosUserId: invitedUser.workosUserId,
          email: invitedUser.email,
          name: invitedUser.name || undefined,
        }],
        type: "team.invitation",
        entityId: String(team._id),
        entityType: "team",
        triggeredByWorkosUserId: ctx.userId,
        locale,
        vars: { inviterName: wsName ?? "Gallurio workspace", teamName: team.name },
      }).catch((err) => {
        console.error("[teams] sendNotification (team.invitation) failed:", err);
      });
    }
  }

  revalidatePath("/[locale]/teams", "page");
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
  const { invitationId } = parsed.data;

  const invObjId = toObjectId(invitationId);
  if (!invObjId) return { error: "Invalid invitation id" };

  const invitation = await Invitation.findOne({
    _id: invObjId,
    workspaceId: ctx.workspace._id,
    status: "pending",
  })
    .select({ _id: 1, teamIds: 1 })
    .lean();

  if (!invitation) return { error: "INVITE_NOT_FOUND" };

  await Invitation.updateOne(
    { _id: invitation._id, workspaceId: ctx.workspace._id },
    { $set: { status: "revoked", revokedAt: new Date() } },
  );

  await releaseInvitationSeats(
    (invitation.teamIds ?? []) as mongoose.Types.ObjectId[],
    ctx.workspace._id,
  );

  revalidatePath("/[locale]/teams", "page");
  return { ok: true };
}

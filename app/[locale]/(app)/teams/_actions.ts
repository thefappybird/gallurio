"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { ownerContext, type ActionResult } from "@/lib/auth/ownerContext";
import {
  createTeamWithCapEnforcement,
  TeamCapExceededError,
} from "@/lib/auth/assertCanAddTeam";
import { Team } from "@/lib/db/models/team";
import { planEntitlements } from "@/lib/plans/entitlements";
import {
  createTeamSchema,
  renameTeamSchema,
  setTeamColorSchema,
  deactivateTeamSchema,
  reactivateTeamSchema,
  type CreateTeamInput,
  type RenameTeamInput,
  type SetTeamColorInput,
  type DeactivateTeamInput,
  type ReactivateTeamInput,
} from "@/lib/validators/team";

type TeamPayload = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  memberCount: number;
};

type CreateTeamResult = ActionResult & { team?: TeamPayload };


function parseObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === 11000
  );
}

export async function createTeamAction(input: CreateTeamInput): Promise<CreateTeamResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = createTeamSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const { name, color } = parsed.data;

  try {
    const team = await createTeamWithCapEnforcement(
      {
        workspaceId: ctx.workspace._id,
        name,
        color,
        isDefault: false,
        memberCount: 0,
        createdByWorkosUserId: ctx.userId,
      },
      ctx.workspace.plan,
    );

    revalidatePath("/[locale]/teams", "page");
    return {
      ok: true,
      team: {
        id: String(team._id),
        name: team.name,
        color: team.color,
        isDefault: team.isDefault,
        isActive: team.isActive,
        memberCount: team.memberCount,
      },
    };
  } catch (err) {
    if (err instanceof TeamCapExceededError) return { error: "TEAM_CAP_EXCEEDED" };
    if (isDuplicateKeyError(err)) return { error: "DUPLICATE_NAME" };
    throw err;
  }
}

export async function renameTeamAction(input: RenameTeamInput): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = renameTeamSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const { teamId, name } = parsed.data;
  const objectId = parseObjectId(teamId);
  if (!objectId) return { error: "Invalid team id" };

  try {
    const team = await Team.findOneAndUpdate(
      { _id: objectId, workspaceId: ctx.workspace._id },
      { $set: { name } },
      { new: true }
    );
    if (!team) return { error: "Team not found" };
  } catch (err) {
    if (isDuplicateKeyError(err)) return { error: "DUPLICATE_NAME" };
    throw err;
  }

  revalidatePath("/[locale]/teams", "page");
  return { ok: true };
}

export async function setTeamColorAction(input: SetTeamColorInput): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = setTeamColorSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const { teamId, color } = parsed.data;
  const objectId = parseObjectId(teamId);
  if (!objectId) return { error: "Invalid team id" };

  const team = await Team.findOneAndUpdate(
    { _id: objectId, workspaceId: ctx.workspace._id },
    { $set: { color } },
    { new: true }
  );
  if (!team) return { error: "Team not found" };

  revalidatePath("/[locale]/teams", "page");
  return { ok: true };
}

// Teams are never hard-deleted — once bookings/transactions reference a team,
// removing the row would break historical record-keeping. Deactivation hides the
// team from default lists and the active-team cap and blocks new assignments,
// while keeping the row, its memberships, and all referencing bookings intact.
export async function deactivateTeamAction(input: DeactivateTeamInput): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = deactivateTeamSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const { teamId } = parsed.data;
  const objectId = parseObjectId(teamId);
  if (!objectId) return { error: "Invalid team id" };

  const team = await Team.findOne({ _id: objectId, workspaceId: ctx.workspace._id });
  if (!team) return { error: "Team not found" };
  // The Main/default team is the assignment fallback and can never be retired.
  if (team.isDefault) return { error: "CANNOT_DEACTIVATE_DEFAULT" };

  // Idempotent: deactivating an already-inactive team is a no-op success. We do
  // NOT touch memberships or bookings — deactivation always succeeds regardless
  // of how much history references the team (that's the whole point).
  if (team.isActive) {
    await Team.updateOne(
      { _id: objectId, workspaceId: ctx.workspace._id },
      { $set: { isActive: false, deactivatedAt: new Date() } },
    );
  }

  revalidatePath("/[locale]/teams", "page");
  return { ok: true };
}

// Reactivation restores a deactivated team to full working order — but only if
// the workspace still has room under its active-team plan cap.
export async function reactivateTeamAction(input: ReactivateTeamInput): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = reactivateTeamSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const { teamId } = parsed.data;
  const objectId = parseObjectId(teamId);
  if (!objectId) return { error: "Invalid team id" };

  const team = await Team.findOne({ _id: objectId, workspaceId: ctx.workspace._id });
  if (!team) return { error: "Team not found" };

  // Idempotent: already-active is a no-op success — and crucially must NOT be
  // blocked by the cap check below (it isn't adding to the active count).
  if (!team.isActive) {
    const { maxTeams } = planEntitlements(ctx.workspace.plan);
    const activeCount = await Team.countDocuments({
      workspaceId: ctx.workspace._id,
      isActive: { $ne: false },
    });
    if (activeCount >= maxTeams) return { error: "REACTIVATE_CAP_EXCEEDED" };

    await Team.updateOne(
      { _id: objectId, workspaceId: ctx.workspace._id },
      { $set: { isActive: true, deactivatedAt: null } },
    );
  }

  revalidatePath("/[locale]/teams", "page");
  return { ok: true };
}

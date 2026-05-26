"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { ownerContext, type ActionResult } from "@/lib/auth/ownerContext";
import { assertCanAddTeam, TeamCapExceededError } from "@/lib/auth/assertCanAddTeam";
import { Team } from "@/lib/db/models/team";
import { TeamMembership } from "@/lib/db/models/teamMembership";
import {
  createTeamSchema,
  renameTeamSchema,
  setTeamColorSchema,
  deleteTeamSchema,
  type CreateTeamInput,
  type RenameTeamInput,
  type SetTeamColorInput,
  type DeleteTeamInput,
} from "@/lib/validators/team";

type TeamPayload = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
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
    await assertCanAddTeam(ctx.workspace._id, ctx.workspace.plan);
  } catch (err) {
    if (err instanceof TeamCapExceededError) {
      return { error: "TEAM_CAP_EXCEEDED" };
    }
    throw err;
  }

  try {
    const team = await Team.create({
      workspaceId: ctx.workspace._id,
      name,
      color,
      isDefault: false,
      memberCount: 0,
      createdByClerkUserId: ctx.userId,
    });

    revalidatePath("/settings/teams", "page");
    return {
      ok: true,
      team: {
        id: String(team._id),
        name: team.name,
        color: team.color,
        isDefault: team.isDefault,
        memberCount: team.memberCount,
      },
    };
  } catch (err) {
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

  revalidatePath("/settings/teams", "page");
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

  revalidatePath("/settings/teams", "page");
  return { ok: true };
}

export async function deleteTeamAction(input: DeleteTeamInput): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = deleteTeamSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const { teamId } = parsed.data;
  const objectId = parseObjectId(teamId);
  if (!objectId) return { error: "Invalid team id" };

  const team = await Team.findOne({ _id: objectId, workspaceId: ctx.workspace._id });
  if (!team) return { error: "Team not found" };
  if (team.isDefault) return { error: "CANNOT_DELETE_DEFAULT" };

  // TODO(phase-4): reject deletion if bookings reference this team

  await TeamMembership.deleteMany({ teamId: objectId });
  await Team.deleteOne({ _id: objectId, workspaceId: ctx.workspace._id });

  revalidatePath("/settings/teams", "page");
  return { ok: true };
}

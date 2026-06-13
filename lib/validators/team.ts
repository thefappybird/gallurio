import { z } from "zod";

// Any 6-digit hex color is allowed — the picker offers curated presets but the
// owner may dial in an exact brand color via the spectrum. Normalize to a
// lowercase #rrggbb so the stored value is stable regardless of input casing.
const hexColor = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "Invalid team color");

export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Team name is required")
    .max(40, "Team name must be 40 characters or fewer"),
  color: hexColor,
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const renameTeamSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  name: z
    .string()
    .trim()
    .min(1, "Team name is required")
    .max(40, "Team name must be 40 characters or fewer"),
});
export type RenameTeamInput = z.infer<typeof renameTeamSchema>;

export const setTeamColorSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  color: hexColor,
});
export type SetTeamColorInput = z.infer<typeof setTeamColorSchema>;

// Teams are soft-deleted (deactivated), never hard-deleted, once any booking or
// transaction references them. Both actions take just the team id.
export const deactivateTeamSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
});
export type DeactivateTeamInput = z.infer<typeof deactivateTeamSchema>;

export const reactivateTeamSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
});
export type ReactivateTeamInput = z.infer<typeof reactivateTeamSchema>;

export const inviteMemberSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    teamIds: z
      .array(z.string().min(1))
      .min(1, "Pick at least one team")
      .max(15, "Too many teams selected"),
    leadOnTeamIds: z.array(z.string().min(1)).default([]),
  })
  .refine(
    (v) => v.leadOnTeamIds.every((id) => v.teamIds.includes(id)),
    { message: "Lead flag can only be set on selected teams", path: ["leadOnTeamIds"] },
  );
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const assignMemberToTeamSchema = z.object({
  workosUserId: z.string().min(1),
  teamId: z.string().min(1),
  role: z.enum(["member", "lead"]).default("member"),
});
export type AssignMemberToTeamInput = z.infer<typeof assignMemberToTeamSchema>;

export const removeMemberFromTeamSchema = z.object({
  workosUserId: z.string().min(1),
  teamId: z.string().min(1),
});
export type RemoveMemberFromTeamInput = z.infer<typeof removeMemberFromTeamSchema>;

export const setLeadFlagSchema = z.object({
  workosUserId: z.string().min(1),
  teamId: z.string().min(1),
  isLead: z.boolean(),
});
export type SetLeadFlagInput = z.infer<typeof setLeadFlagSchema>;

export const removeMemberFromWorkspaceSchema = z.object({
  workosUserId: z.string().min(1),
});
export type RemoveMemberFromWorkspaceInput = z.infer<typeof removeMemberFromWorkspaceSchema>;

export const revokeInviteSchema = z.object({
  invitationId: z.string().min(1, "Invitation ID is required"),
});
export type RevokeInviteInput = z.infer<typeof revokeInviteSchema>;

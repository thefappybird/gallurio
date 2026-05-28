import { z } from "zod";
import { TEAM_COLOR_PALETTE } from "@/lib/db/models/team";

const validColor = (c: string) => (TEAM_COLOR_PALETTE as readonly string[]).includes(c);

export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Team name is required")
    .max(40, "Team name must be 40 characters or fewer"),
  color: z.string().refine(validColor, "Invalid team color"),
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
  color: z.string().refine(validColor, "Invalid team color"),
});
export type SetTeamColorInput = z.infer<typeof setTeamColorSchema>;

export const deleteTeamSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
});
export type DeleteTeamInput = z.infer<typeof deleteTeamSchema>;

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
  clerkUserId: z.string().min(1),
  teamId: z.string().min(1),
  role: z.enum(["member", "lead"]).default("member"),
});
export type AssignMemberToTeamInput = z.infer<typeof assignMemberToTeamSchema>;

export const removeMemberFromTeamSchema = z.object({
  clerkUserId: z.string().min(1),
  teamId: z.string().min(1),
});
export type RemoveMemberFromTeamInput = z.infer<typeof removeMemberFromTeamSchema>;

export const setLeadFlagSchema = z.object({
  clerkUserId: z.string().min(1),
  teamId: z.string().min(1),
  isLead: z.boolean(),
});
export type SetLeadFlagInput = z.infer<typeof setLeadFlagSchema>;

export const removeMemberFromWorkspaceSchema = z.object({
  clerkUserId: z.string().min(1),
});
export type RemoveMemberFromWorkspaceInput = z.infer<typeof removeMemberFromWorkspaceSchema>;

export const revokeInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});
export type RevokeInviteInput = z.infer<typeof revokeInviteSchema>;

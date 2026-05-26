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

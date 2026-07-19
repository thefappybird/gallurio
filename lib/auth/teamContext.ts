import { cache } from "react";
import mongoose from "mongoose";
import { TeamMembership } from "@/lib/db/models/teamMembership";
import { connectDB } from "@/lib/db/mongoose";

export type UserTeamMembership = {
  teamId: string;
  role: "member" | "lead";
};

// React `cache()` dedupes per-request so multiple callers in the same render
// pass share one Mongo round-trip. Keep this small and side-effect free.
export const getTeamsForUser = cache(
  async (
    workspaceId: mongoose.Types.ObjectId | string,
    workosUserId: string,
  ): Promise<UserTeamMembership[]> => {
    if (!workspaceId || !workosUserId) return [];
    await connectDB();
    const wsId =
      typeof workspaceId === "string"
        ? new mongoose.Types.ObjectId(workspaceId)
        : workspaceId;
    const rows = await TeamMembership.find({ workspaceId: wsId, workosUserId })
      .select({ teamId: 1, role: 1 })
      .lean();
    return rows.map((r) => ({
      teamId: String(r.teamId),
      role: (r.role ?? "member") as "member" | "lead",
    }));
  },
);

export function isLeadOnTeam(
  memberships: UserTeamMembership[],
  teamId: string,
): boolean {
  return memberships.some((m) => m.teamId === teamId && m.role === "lead");
}

export function isOnTeam(
  memberships: UserTeamMembership[],
  teamId: string,
): boolean {
  return memberships.some((m) => m.teamId === teamId);
}

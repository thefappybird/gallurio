import "server-only";
import type { Types } from "mongoose";
import { Team } from "@/lib/db/models";
import { getTeamsForUser } from "@/lib/auth/teamContext";

// A team the caller can see in the bookings UI. `isLead` reflects write
// capability for non-owners (owners may write to any active team, so it's set
// true for them). Inactive teams are still returned — they appear in the picker
// as view-only choices and color calendar candles as "archival".
export type BookingTeamOption = {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  isLead: boolean;
};

type Ctx = {
  role: "owner" | "staff";
  userId: string;
  workspace: { _id: Types.ObjectId };
};

// Resolves the teams a caller can see for the bookings team picker + calendar
// color map. Owners see every team in the workspace (active first, default next);
// non-owners see only the teams they belong to. Both include deactivated teams.
export async function getBookingTeamOptions(ctx: Ctx): Promise<BookingTeamOption[]> {
  if (ctx.role === "owner") {
    const teams = await Team.find({ workspaceId: ctx.workspace._id })
      .select({ _id: 1, name: 1, color: 1, isActive: 1, isDefault: 1 })
      .sort({ isActive: -1, isDefault: -1, name: 1 })
      .lean();
    return teams.map((t) => ({
      id: String(t._id),
      name: t.name,
      color: t.color,
      isActive: t.isActive,
      isLead: true,
    }));
  }

  const memberships = await getTeamsForUser(ctx.workspace._id, ctx.userId);
  if (memberships.length === 0) return [];
  const leadSet = new Set(memberships.filter((m) => m.role === "lead").map((m) => m.teamId));
  const ids = memberships.map((m) => m.teamId);
  const teams = await Team.find({ workspaceId: ctx.workspace._id, _id: { $in: ids } })
    .select({ _id: 1, name: 1, color: 1, isActive: 1 })
    .sort({ isActive: -1, name: 1 })
    .lean();
  return teams.map((t) => ({
    id: String(t._id),
    name: t.name,
    color: t.color,
    isActive: t.isActive,
    isLead: leadSet.has(String(t._id)),
  }));
}

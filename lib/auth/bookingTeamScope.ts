import "server-only";
import type { Types } from "mongoose";
import { getTeamsForUser } from "@/lib/auth/teamContext";

type ScopeContext = {
  role: "owner" | "staff";
  userId: string;
  workspace: { _id: Types.ObjectId };
};

// Resolves the team-visibility scope for a booking READ. Owners see the whole
// workspace (returns `undefined` → no team restriction). Non-owners see only
// bookings owned by teams they belong to — including deactivated teams they're
// still a member of, so their historical work stays visible. An empty array is
// returned (not undefined) when a non-owner has no memberships, so the caller's
// `$in` filter matches nothing (fail-closed). Pass the result straight to
// `listBookings({ teamIds })` / `getBookingById(..., allowedTeamIds)` or build a
// `{ teamId: { $in } }` filter from it.
export async function resolveBookingTeamScope(
  ctx: ScopeContext,
): Promise<string[] | undefined> {
  if (ctx.role === "owner") return undefined;
  const memberships = await getTeamsForUser(ctx.workspace._id, ctx.userId);
  return memberships.map((m) => m.teamId);
}

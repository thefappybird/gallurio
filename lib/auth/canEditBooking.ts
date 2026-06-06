import type { UserTeamMembership } from "@/lib/auth/teamContext";

export type WorkspaceRole = "owner" | "staff";

export type BookingWriteContext = {
  role: WorkspaceRole;
  // The caller's team memberships, as returned by getTeamsForUser().
  memberships: UserTeamMembership[];
};

// The team a write targets, resolved to just the bits the rule needs. `null`
// means the team could not be resolved (missing/cross-workspace) — treated as
// not-writable for non-owners.
export type WritableTeam = { id: string; isActive: boolean } | null;

function isLeadOf(memberships: UserTeamMembership[], teamId: string): boolean {
  return memberships.some((m) => m.teamId === teamId && m.role === "lead");
}

// Core rule shared by booking creation and editing: who may write a booking that
// belongs to (or is being assigned to) a given team.
//
//  - Owner: always — including bookings on a since-deactivated team, so the
//    owner can still reassign or clean up historical records.
//  - Non-owner: must be a LEAD of that team AND the team must still be active.
//    Plain members are view-only in the MVP. The staffIds-based member-edit
//    path is a deliberate future hook (Decision 1) and is intentionally NOT
//    wired here — adding it later means OR-ing in a staffIds membership check.
export function canWriteBookingForTeam(
  ctx: BookingWriteContext,
  team: WritableTeam,
): boolean {
  if (ctx.role === "owner") return true;
  if (!team || !team.isActive) return false;
  return isLeadOf(ctx.memberships, team.id);
}

// Edit gate for an existing booking. `team` must be the resolved Team for
// `booking.teamId` (or null if it can't be resolved). Owners may edit any
// booking regardless of its team's active state; non-owners need to be a lead
// of the booking's still-active team.
export function canEditBooking(
  ctx: BookingWriteContext,
  booking: { teamId: string | null | undefined },
  team: WritableTeam,
): boolean {
  if (ctx.role === "owner") return true;
  if (!booking.teamId) return false;
  return canWriteBookingForTeam(ctx, team);
}

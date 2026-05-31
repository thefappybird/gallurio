import { describe, it, expect } from "vitest";
import {
  canEditBooking,
  canWriteBookingForTeam,
  type BookingWriteContext,
  type WritableTeam,
} from "./canEditBooking";
import type { UserTeamMembership } from "@/lib/auth/teamContext";

const TEAM_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TEAM_B = "bbbbbbbbbbbbbbbbbbbbbbbb";

const activeA: WritableTeam = { id: TEAM_A, isActive: true };
const inactiveA: WritableTeam = { id: TEAM_A, isActive: false };

function ctx(role: "owner" | "staff", memberships: UserTeamMembership[] = []): BookingWriteContext {
  return { role, memberships };
}

const leadOfA: UserTeamMembership[] = [{ teamId: TEAM_A, role: "lead" }];
const memberOfA: UserTeamMembership[] = [{ teamId: TEAM_A, role: "member" }];
const leadOfB: UserTeamMembership[] = [{ teamId: TEAM_B, role: "lead" }];

describe("canWriteBookingForTeam", () => {
  it("owner can always write — active team", () => {
    expect(canWriteBookingForTeam(ctx("owner"), activeA)).toBe(true);
  });

  it("owner can write to an inactive team (for reassignment/cleanup)", () => {
    expect(canWriteBookingForTeam(ctx("owner"), inactiveA)).toBe(true);
  });

  it("owner can write even when the team can't be resolved", () => {
    expect(canWriteBookingForTeam(ctx("owner"), null)).toBe(true);
  });

  it("lead of an active team can write", () => {
    expect(canWriteBookingForTeam(ctx("staff", leadOfA), activeA)).toBe(true);
  });

  it("lead of an INACTIVE team cannot write (no new work on dead teams)", () => {
    expect(canWriteBookingForTeam(ctx("staff", leadOfA), inactiveA)).toBe(false);
  });

  it("plain member of an active team cannot write (view-only MVP)", () => {
    expect(canWriteBookingForTeam(ctx("staff", memberOfA), activeA)).toBe(false);
  });

  it("lead of a different team cannot write", () => {
    expect(canWriteBookingForTeam(ctx("staff", leadOfB), activeA)).toBe(false);
  });

  it("non-owner with no resolvable team cannot write", () => {
    expect(canWriteBookingForTeam(ctx("staff", leadOfA), null)).toBe(false);
  });

  it("non-owner with no memberships cannot write", () => {
    expect(canWriteBookingForTeam(ctx("staff", []), activeA)).toBe(false);
  });
});

describe("canEditBooking", () => {
  it("owner can edit any booking — active team", () => {
    expect(canEditBooking(ctx("owner"), { teamId: TEAM_A }, activeA)).toBe(true);
  });

  it("owner can edit a booking whose team was later deactivated", () => {
    expect(canEditBooking(ctx("owner"), { teamId: TEAM_A }, inactiveA)).toBe(true);
  });

  it("owner can edit a legacy booking with no teamId", () => {
    expect(canEditBooking(ctx("owner"), { teamId: null }, null)).toBe(true);
  });

  it("lead of the booking's active team can edit", () => {
    expect(canEditBooking(ctx("staff", leadOfA), { teamId: TEAM_A }, activeA)).toBe(true);
  });

  it("lead of the booking's team cannot edit once it's deactivated", () => {
    expect(canEditBooking(ctx("staff", leadOfA), { teamId: TEAM_A }, inactiveA)).toBe(false);
  });

  it("plain member cannot edit (view-only MVP)", () => {
    expect(canEditBooking(ctx("staff", memberOfA), { teamId: TEAM_A }, activeA)).toBe(false);
  });

  it("lead of another team cannot edit this booking", () => {
    expect(canEditBooking(ctx("staff", leadOfB), { teamId: TEAM_A }, activeA)).toBe(false);
  });

  it("non-owner cannot edit a booking with no teamId", () => {
    expect(canEditBooking(ctx("staff", leadOfA), { teamId: null }, null)).toBe(false);
  });
});

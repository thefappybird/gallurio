import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TeamDetailDrawer } from "./team-detail-drawer";
import type { MemberSummary, TeamRow } from "../_types";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("../_member-action", () => ({
  assignMemberToTeamAction: vi.fn(),
  removeMemberFromTeamAction: vi.fn(),
  setLeadFlagAction: vi.fn(),
}));

vi.mock("../_invite-action", () => ({
  revokeInviteAction: vi.fn(),
}));

const TEAM: TeamRow = {
  id: "t1",
  name: "Wedding crew",
  color: "#7c5cff",
  isDefault: false,
  memberCount: 1,
};

const OWNER = "user_owner";

const MEMBERS: MemberSummary[] = [
  { clerkUserId: OWNER, email: "owner@test.com", name: "Owner", teams: [] },
  {
    clerkUserId: "u_on",
    email: "on@test.com",
    name: "On The Team",
    teams: [{ teamId: "t1", role: "member" }],
  },
  { clerkUserId: "u_free", email: "free@test.com", name: "Teamless Tom", teams: [] },
];

function renderDrawer() {
  return renderWithProviders(
    <TeamDetailDrawer
      team={TEAM}
      open
      onOpenChange={vi.fn()}
      members={MEMBERS}
      pendingInvites={[]}
      maxMembersPerTeam={10}
      ownerClerkUserId={OWNER}
      onInvite={vi.fn()}
    />,
  );
}

describe("TeamDetailDrawer", () => {
  it("lists members who belong to this team", () => {
    renderDrawer();
    expect(screen.getByText("On The Team")).toBeInTheDocument();
  });

  it("does not show teamless members or the owner in the on-team list (select closed)", () => {
    renderDrawer();
    // Teamless Tom is assignable (lives behind the closed Select), so he is not
    // rendered in the visible member list.
    expect(screen.queryByText("Teamless Tom")).not.toBeInTheDocument();
    // Owner is excluded from this team's roster here (not assigned).
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
  });

  it("offers the add-existing-member control when assignable members exist", () => {
    renderDrawer();
    // Teamless Tom + Owner... owner is excluded, Tom is assignable, so the
    // 'everyone already on team' empty message must NOT appear.
    expect(
      screen.queryByText("Everyone in this workspace is already on this team."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Add existing member")).toBeInTheDocument();
  });
});

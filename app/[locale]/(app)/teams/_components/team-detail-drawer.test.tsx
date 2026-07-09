import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TeamDetailDrawer } from "./team-detail-drawer";
import { setLeadFlagAction } from "../_member-action";
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
  isActive: true,
  memberCount: 1,
};

const OWNER = "user_owner_workos";

const MEMBERS: MemberSummary[] = [
  { workosUserId: OWNER, email: "owner@test.com", name: "Owner", teams: [] },
  {
    workosUserId: "u_on",
    email: "on@test.com",
    name: "On The Team",
    teams: [{ teamId: "t1", role: "member" }],
  },
  { workosUserId: "u_free", email: "free@test.com", name: "Teamless Tom", teams: [] },
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
      ownerWorkosUserId={OWNER}
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

  it("disables the lead toggle for other members once the team has a lead", () => {
    const membersWithLead: MemberSummary[] = [
      { workosUserId: OWNER, email: "owner@test.com", name: "Owner", teams: [] },
      {
        workosUserId: "u_lead",
        email: "lead@test.com",
        name: "Lead Member",
        teams: [{ teamId: "t1", role: "lead" }],
      },
      {
        workosUserId: "u_other",
        email: "other@test.com",
        name: "Other Member",
        teams: [{ teamId: "t1", role: "member" }],
      },
    ];
    renderWithProviders(
      <TeamDetailDrawer
        team={TEAM}
        open
        onOpenChange={vi.fn()}
        members={membersWithLead}
        pendingInvites={[]}
        maxMembersPerTeam={10}
        ownerWorkosUserId={OWNER}
        onInvite={vi.fn()}
      />,
    );

    // The existing lead can still toggle themselves off…
    expect(document.getElementById("lead-u_lead")).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // …but every other member's lead toggle is disabled.
    expect(document.getElementById("lead-u_other")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("reveals the one-lead warning on hover and focus without requiring a click", () => {
    const membersWithLead: MemberSummary[] = [
      { workosUserId: OWNER, email: "owner@test.com", name: "Owner", teams: [] },
      {
        workosUserId: "u_lead",
        email: "lead@test.com",
        name: "Lead Member",
        teams: [{ teamId: "t1", role: "lead" }],
      },
      {
        workosUserId: "u_other",
        email: "other@test.com",
        name: "Other Member",
        teams: [{ teamId: "t1", role: "member" }],
      },
    ];
    renderWithProviders(
      <TeamDetailDrawer
        team={TEAM}
        open
        onOpenChange={vi.fn()}
        members={membersWithLead}
        pendingInvites={[]}
        maxMembersPerTeam={10}
        ownerWorkosUserId={OWNER}
        onInvite={vi.fn()}
      />,
    );

    const toggle = document.getElementById("lead-u_other")!;
    const warning = "A team can only have one lead.";

    // Idle: no warning.
    expect(screen.queryByText(warning)).not.toBeInTheDocument();

    // Hover reveals it (no click), leaving hides it.
    fireEvent.mouseEnter(toggle);
    expect(screen.getByText(warning)).toBeInTheDocument();
    fireEvent.mouseLeave(toggle);
    expect(screen.queryByText(warning)).not.toBeInTheDocument();

    // Keyboard focus also reveals it (not hover-only), blur hides it.
    fireEvent.focus(toggle);
    expect(screen.getByText(warning)).toBeInTheDocument();
    fireEvent.blur(toggle);
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
  });

  it("shows a distinct busy indicator on the lead toggle while the promote action is in flight", async () => {
    vi.mocked(setLeadFlagAction).mockReturnValue(new Promise(() => {}));
    renderDrawer();

    const toggle = screen.getByRole("switch");
    expect(toggle).not.toHaveAttribute("aria-disabled", "true");

    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute("aria-disabled", "true"));
    expect(toggle).toHaveAttribute("aria-busy", "true");
  });
});

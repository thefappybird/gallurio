import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ViewMembersSidebar } from "./view-members-sidebar";
import type { MemberSummary, TeamRow } from "../_types";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("../_member-action", () => ({
  removeMemberFromTeamAction: vi.fn(),
  removeMemberFromWorkspaceAction: vi.fn(),
}));

vi.mock("../_invite-action", () => ({
  revokeInviteAction: vi.fn(),
}));

const TEAMS: TeamRow[] = [
  { id: "t1", name: "Wedding crew", color: "#7c5cff", isDefault: false, isActive: true, memberCount: 2 },
];

const FOUR_TEAMS: TeamRow[] = [
  { id: "t1", name: "Team One", color: "#ffffff", isDefault: false, isActive: true, memberCount: 1 },
  { id: "t2", name: "Team Two", color: "#000000", isDefault: false, isActive: true, memberCount: 1 },
  { id: "t3", name: "Team Three", color: "#7c5cff", isDefault: false, isActive: true, memberCount: 1 },
  { id: "t4", name: "Team Four", color: "#ef4444", isDefault: false, isActive: true, memberCount: 1 },
];

const MEMBERS: MemberSummary[] = [
  { workosUserId: "u_owner", email: "owner@test.com", name: "Owner", teams: [] },
  {
    workosUserId: "u_on",
    email: "on@test.com",
    name: "On The Team",
    teams: [{ teamId: "t1", role: "lead" }],
  },
];

const PENDING_INVITES = [
  {
    invitationId: "invite_1",
    email: "pending@test.com",
    teamIds: ["t1"],
    leadOnTeamIds: [],
    invitedAt: "2026-07-18T00:00:00.000Z",
    expiresAt: "2026-07-25T00:00:00.000Z",
  },
];

describe("ViewMembersSidebar", () => {
  it("lists every workspace member", () => {
    renderWithProviders(
      <ViewMembersSidebar
        members={MEMBERS}
        pendingInvites={[]}
        teams={TEAMS}
        ownerWorkosUserId="u_owner"
        workspaceId="ws1"
        canManage
        open
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Owner")).toHaveLength(2);
    expect(screen.getByText("On The Team")).toBeInTheDocument();
  });

  it("shows team badges and presents the owner as able to oversee all teams", () => {
    renderWithProviders(
      <ViewMembersSidebar
        members={MEMBERS}
        pendingInvites={[]}
        teams={TEAMS}
        ownerWorkosUserId="u_owner"
        workspaceId="ws1"
        canManage
        open
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Wedding crew")).toBeInTheDocument();
    expect(screen.getAllByText("Owner")).toHaveLength(2);
    expect(screen.getByText("Can oversee all teams")).toBeInTheDocument();
    expect(screen.queryByText("Not on any team")).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox").closest("div.sticky")).not.toBeNull();
  });

  it("shows a remove action per member when canManage, but not for the owner row", () => {
    renderWithProviders(
      <ViewMembersSidebar
        members={MEMBERS}
        pendingInvites={[]}
        teams={TEAMS}
        ownerWorkosUserId="u_owner"
        workspaceId="ws1"
        canManage
        open
        onOpenChange={vi.fn()}
      />,
    );
    const removeButton = screen.getByRole("button", {
      name: "Remove from workspace for On The Team",
    });
    expect(removeButton).toBeInTheDocument();
    expect(removeButton).toHaveAttribute("title", "Remove from workspace for On The Team");
    expect(
      screen.queryByRole("button", { name: "Remove from workspace for Owner" }),
    ).not.toBeInTheDocument();
  });

  it("uses contrast-safe team pills and opens the full team list in member details", () => {
    const multiTeamMember: MemberSummary = {
      workosUserId: "u_multi",
      email: "multi@test.com",
      name: "Multi Team",
      teams: FOUR_TEAMS.map((team) => ({ teamId: team.id, role: "member" })),
    };
    renderWithProviders(
      <ViewMembersSidebar
        members={[multiTeamMember]}
        pendingInvites={[]}
        teams={FOUR_TEAMS}
        ownerWorkosUserId="owner_elsewhere"
        workspaceId="ws1"
        canManage
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Team One").parentElement).toHaveStyle({
      backgroundColor: "#ffffff",
      color: "#1a1a1a",
    });
    expect(screen.getByText("Team Two").parentElement).toHaveStyle({
      backgroundColor: "#000000",
      color: "#ffffff",
    });
    expect(screen.getByText("Team Three")).toBeInTheDocument();
    expect(screen.queryByText("Team Four")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View Multi Team" }));
    expect(screen.getByText("Team Four")).toBeInTheDocument();
  });

  it("lists pending invitations and lets managers revoke one", async () => {
    const { revokeInviteAction } = await import("../_invite-action");
    vi.mocked(revokeInviteAction).mockResolvedValue({ ok: true });
    const onInvite = vi.fn();

    renderWithProviders(
      <ViewMembersSidebar
        members={MEMBERS}
        pendingInvites={PENDING_INVITES}
        teams={TEAMS}
        ownerWorkosUserId="u_owner"
        workspaceId="ws1"
        canManage
        onInvite={onInvite}
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Pending" }));
    expect(screen.getByText("pending@test.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Invite member" }));
    expect(onInvite).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Revoke invite" }));
    await waitFor(() =>
      expect(revokeInviteAction).toHaveBeenCalledWith({ invitationId: "invite_1" }),
    );
  });

  it("paginates each mode locally and clears filters when switching modes", () => {
    const manyMembers: MemberSummary[] = Array.from({ length: 11 }, (_, index) => ({
      workosUserId: `user_${index}`,
      email: `member${index}@test.com`,
      name: `Member ${index}`,
      teams: [],
    }));
    const manyInvites = Array.from({ length: 11 }, (_, index) => ({
      invitationId: `invite_${index}`,
      email: `pending${index}@test.com`,
      teamIds: ["t1"],
      leadOnTeamIds: [],
      invitedAt: "2026-07-18T00:00:00.000Z",
      expiresAt: "2026-07-25T00:00:00.000Z",
    }));

    renderWithProviders(
      <ViewMembersSidebar
        members={manyMembers}
        pendingInvites={manyInvites}
        teams={TEAMS}
        ownerWorkosUserId="owner_elsewhere"
        workspaceId="ws1"
        canManage
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Member 0")).toBeInTheDocument();
    expect(screen.queryByText("Member 10")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Member 10")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Pending" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("pending10@test.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Active" }));
    // The active list's page survives a mode switch.
    expect(screen.getByText("Member 10")).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search name or email" });
    fireEvent.change(search, { target: { value: "Member 0" } });
    expect(screen.getByText("Member 0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Pending" }));
    expect(screen.getByText("pending10@test.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Active" }));
    expect(search).toHaveValue("");
    expect(screen.getByText("Member 0")).toBeInTheDocument();
  });

  it("keeps the pagination footer visible for an empty filtered list", () => {
    renderWithProviders(
      <ViewMembersSidebar
        members={MEMBERS}
        pendingInvites={[]}
        teams={TEAMS}
        ownerWorkosUserId="u_owner"
        workspaceId="ws1"
        canManage
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no match" } });
    expect(screen.getByText("Showing 0–0 of 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("distinguishes an empty member search from an actually empty pending list", () => {
    renderWithProviders(
      <ViewMembersSidebar
        members={MEMBERS}
        pendingInvites={[]}
        teams={TEAMS}
        ownerWorkosUserId="u_owner"
        workspaceId="ws1"
        canManage
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no match" } });
    expect(screen.getByText("No members match your search.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Pending" }));
    expect(screen.getByText("No pending invites.")).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
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

const TEAMS: TeamRow[] = [
  { id: "t1", name: "Wedding crew", color: "#7c5cff", isDefault: false, isActive: true, memberCount: 2 },
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

describe("ViewMembersSidebar", () => {
  it("lists every workspace member", () => {
    renderWithProviders(
      <ViewMembersSidebar
        members={MEMBERS}
        teams={TEAMS}
        ownerWorkosUserId="u_owner"
        workspaceId="ws1"
        canManage
        open
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("On The Team")).toBeInTheDocument();
  });

  it("shows each member's team badges with their role, and 'not on any team' when they have none", () => {
    renderWithProviders(
      <ViewMembersSidebar
        members={MEMBERS}
        teams={TEAMS}
        ownerWorkosUserId="u_owner"
        workspaceId="ws1"
        canManage
        open
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Wedding crew")).toBeInTheDocument();
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("Not on any team")).toBeInTheDocument();
  });

  it("shows a remove action per member when canManage, but not for the owner row", () => {
    renderWithProviders(
      <ViewMembersSidebar
        members={MEMBERS}
        teams={TEAMS}
        ownerWorkosUserId="u_owner"
        workspaceId="ws1"
        canManage
        open
        onOpenChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Remove from workspace for On The Team" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove from workspace for Owner" }),
    ).not.toBeInTheDocument();
  });
});

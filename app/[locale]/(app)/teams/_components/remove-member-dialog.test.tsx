import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { RemoveMemberDialog } from "./remove-member-dialog";
import { removeMemberFromTeamAction, removeMemberFromTeamAndWorkspaceAction } from "../_member-action";

vi.mock("../_member-action", () => ({
  removeMemberFromTeamAction: vi.fn(),
  removeMemberFromTeamAndWorkspaceAction: vi.fn(),
  removeMemberFromWorkspaceAction: vi.fn(),
}));

const MEMBER = { workosUserId: "u1", name: "Ana Cruz", email: "ana@test.com", teams: [{ teamId: "t1", role: "member" as const }] };
const props = { mode: "team" as const, member: MEMBER, teamId: "t1", teamName: "Wedding crew", open: true, onOpenChange: vi.fn() };

describe("RemoveMemberDialog", () => {
  it("offers direct team and combined removal without the obsolete second prompt", () => {
    renderWithProviders(<RemoveMemberDialog {...props} />);
    expect(screen.getByRole("button", { name: "Remove from team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove from team + workspace" })).toBeInTheDocument();
    expect(screen.queryByText(/Also remove/i)).not.toBeInTheDocument();
  });

  it("uses the transactional combined action", async () => {
    vi.mocked(removeMemberFromTeamAndWorkspaceAction).mockResolvedValue({ ok: true });
    renderWithProviders(<RemoveMemberDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove from team + workspace" }));
    await waitFor(() => expect(removeMemberFromTeamAndWorkspaceAction).toHaveBeenCalledWith({ workosUserId: "u1", teamId: "t1" }));
  });

  it("disables combined removal with accessible help when the member is on other teams", () => {
    renderWithProviders(<RemoveMemberDialog {...props} member={{ ...MEMBER, teams: [...MEMBER.teams, { teamId: "t2", role: "member" }] }} />);
    expect(screen.getByRole("button", { name: "Remove from team + workspace" })).toBeDisabled();
    expect(screen.getAllByText(/belongs to other teams/i)).not.toHaveLength(0);
  });

  it("blocks all team removal actions for a lead", () => {
    renderWithProviders(<RemoveMemberDialog {...props} member={{ ...MEMBER, teams: [{ teamId: "t1", role: "lead" }] }} />);
    expect(screen.getByRole("button", { name: "Remove from team" })).toBeDisabled();
    expect(removeMemberFromTeamAction).not.toHaveBeenCalled();
  });
});

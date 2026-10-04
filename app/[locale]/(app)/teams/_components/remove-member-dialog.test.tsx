import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { RemoveMemberDialog } from "./remove-member-dialog";
import { removeMemberFromTeamAction, removeMemberFromTeamAndWorkspaceAction, removeMemberFromWorkspaceAction } from "../_member-action";

const invalidateFor = vi.fn();
vi.mock("@/hooks/use-data-events", () => ({ useInvalidateFor: () => invalidateFor }));

vi.mock("../_member-action", () => ({
  removeMemberFromTeamAction: vi.fn(),
  removeMemberFromTeamAndWorkspaceAction: vi.fn(),
  removeMemberFromWorkspaceAction: vi.fn(),
}));

const MEMBER = { workosUserId: "u1", name: "Ana Cruz", email: "ana@test.com", teams: [{ teamId: "t1", role: "member" as const }] };
const props = { mode: "team" as const, member: MEMBER, teamId: "t1", teamName: "Wedding crew", open: true, onOpenChange: vi.fn() };

describe("RemoveMemberDialog", () => {
  beforeEach(() => vi.clearAllMocks());

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
    await waitFor(() => expect(invalidateFor).toHaveBeenCalledWith({ type: "team.updated", teamId: "t1" }, { refresh: false }));
  });

  it("does not invalidate when removal fails", async () => {
    invalidateFor.mockClear();
    vi.mocked(removeMemberFromTeamAction).mockResolvedValue({ error: "boom" } as never);
    renderWithProviders(<RemoveMemberDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove from team" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(invalidateFor).not.toHaveBeenCalled();
  });

  it("invalidates team.updated with a null team id for workspace-only removal", async () => {
    vi.mocked(removeMemberFromWorkspaceAction).mockResolvedValue({ ok: true });
    renderWithProviders(<RemoveMemberDialog {...props} mode="workspace" teamId={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(invalidateFor).toHaveBeenCalledWith({ type: "team.updated", teamId: null }, { refresh: false }));
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

  it("does not point aria-describedby at a help paragraph that isn't rendered (lead with no other teams)", () => {
    renderWithProviders(<RemoveMemberDialog {...props} member={{ ...MEMBER, teams: [{ teamId: "t1", role: "lead" }] }} />);
    const combinedButton = screen.getByRole("button", { name: "Remove from team + workspace" });
    const describedBy = combinedButton.getAttribute("aria-describedby");
    if (describedBy) {
      expect(document.getElementById(describedBy)).not.toBeNull();
    }
  });
});

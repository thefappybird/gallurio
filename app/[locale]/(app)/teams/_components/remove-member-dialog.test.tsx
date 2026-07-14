import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { RemoveMemberDialog } from "./remove-member-dialog";
import {
  removeMemberFromTeamAction,
  removeMemberFromWorkspaceAction,
} from "../_member-action";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("../_member-action", () => ({
  removeMemberFromTeamAction: vi.fn(),
  removeMemberFromWorkspaceAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const MEMBER = { workosUserId: "u1", name: "Ana Cruz", email: "ana@test.com" };

beforeEach(() => {
  vi.mocked(removeMemberFromTeamAction).mockReset();
  vi.mocked(removeMemberFromWorkspaceAction).mockReset();
  window.localStorage.clear();
});

describe("RemoveMemberDialog", () => {
  it("in team mode, shows a confirm button asking to remove the member from the team", () => {
    renderWithProviders(
      <RemoveMemberDialog
        mode="team"
        member={MEMBER}
        workspaceId="ws1"
        teamId="t1"
        teamName="Wedding crew"
        open
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Remove from team" })).toBeInTheDocument();
  });

  it("confirming the team removal calls removeMemberFromTeamAction and then offers to also remove from the workspace", async () => {
    vi.mocked(removeMemberFromTeamAction).mockResolvedValue({ ok: true });
    renderWithProviders(
      <RemoveMemberDialog
        mode="team"
        member={MEMBER}
        workspaceId="ws1"
        teamId="t1"
        teamName="Wedding crew"
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove from team" }));

    await waitFor(() =>
      expect(removeMemberFromTeamAction).toHaveBeenCalledWith({
        workosUserId: "u1",
        teamId: "t1",
      }),
    );
    expect(
      await screen.findByText("Also remove Ana Cruz from the workspace?"),
    ).toBeInTheDocument();
  });

  it("in workspace mode, shows a single-step confirm asking to remove the member entirely", () => {
    renderWithProviders(
      <RemoveMemberDialog
        mode="workspace"
        member={MEMBER}
        workspaceId="ws1"
        open
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Remove member?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove member" })).toBeInTheDocument();
  });

  it("confirming the workspace removal calls removeMemberFromWorkspaceAction and closes on success", async () => {
    vi.mocked(removeMemberFromWorkspaceAction).mockResolvedValue({ ok: true });
    const onOpenChange = vi.fn();
    renderWithProviders(
      <RemoveMemberDialog
        mode="workspace"
        member={MEMBER}
        workspaceId="ws1"
        open
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove member" }));

    await waitFor(() =>
      expect(removeMemberFromWorkspaceAction).toHaveBeenCalledWith({ workosUserId: "u1" }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows a legible block message instead of removing, when the member is a team lead", async () => {
    vi.mocked(removeMemberFromWorkspaceAction).mockResolvedValue({
      error: "IS_TEAM_LEAD",
      teamName: "Wedding crew",
    });
    const onOpenChange = vi.fn();
    renderWithProviders(
      <RemoveMemberDialog
        mode="workspace"
        member={MEMBER}
        workspaceId="ws1"
        open
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove member" }));

    expect(
      await screen.findByText(
        "Ana Cruz is a team lead for Wedding crew. Remove their team lead status first in order to delete them.",
      ),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("skips the workspace prompt and closes directly when the don't-ask-again flag is already set", async () => {
    window.localStorage.setItem("gw_hide_workspace_removal_prompt:ws1", "1");
    vi.mocked(removeMemberFromTeamAction).mockResolvedValue({ ok: true });
    const onOpenChange = vi.fn();
    renderWithProviders(
      <RemoveMemberDialog
        mode="team"
        member={MEMBER}
        workspaceId="ws1"
        teamId="t1"
        teamName="Wedding crew"
        open
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove from team" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByText("Also remove Ana Cruz from the workspace?")).not.toBeInTheDocument();
  });

  it("from the workspace prompt, checking don't-ask-again and choosing Keep in workspace persists the flag without removing", async () => {
    vi.mocked(removeMemberFromTeamAction).mockResolvedValue({ ok: true });
    const onOpenChange = vi.fn();
    renderWithProviders(
      <RemoveMemberDialog
        mode="team"
        member={MEMBER}
        workspaceId="ws1"
        teamId="t1"
        teamName="Wedding crew"
        open
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove from team" }));
    await screen.findByText("Also remove Ana Cruz from the workspace?");

    fireEvent.click(screen.getByLabelText("Don't ask me again"));
    fireEvent.click(screen.getByRole("button", { name: "Keep in workspace" }));

    expect(removeMemberFromWorkspaceAction).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(
      window.localStorage.getItem("gw_hide_workspace_removal_prompt:ws1"),
    ).toBe("1");
    // confirms persistence happens via the Keep-in-workspace path
  });

  it("from the workspace prompt, choosing Remove from workspace calls removeMemberFromWorkspaceAction", async () => {
    vi.mocked(removeMemberFromTeamAction).mockResolvedValue({ ok: true });
    vi.mocked(removeMemberFromWorkspaceAction).mockResolvedValue({ ok: true });
    const onOpenChange = vi.fn();
    renderWithProviders(
      <RemoveMemberDialog
        mode="team"
        member={MEMBER}
        workspaceId="ws1"
        teamId="t1"
        teamName="Wedding crew"
        open
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove from team" }));
    await screen.findByText("Also remove Ana Cruz from the workspace?");

    fireEvent.click(screen.getByRole("button", { name: "Remove from workspace" }));

    await waitFor(() =>
      expect(removeMemberFromWorkspaceAction).toHaveBeenCalledWith({ workosUserId: "u1" }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("from the workspace prompt, choosing Remove from workspace shows the block message when the member is a team lead", async () => {
    vi.mocked(removeMemberFromTeamAction).mockResolvedValue({ ok: true });
    vi.mocked(removeMemberFromWorkspaceAction).mockResolvedValue({
      error: "IS_TEAM_LEAD",
      teamName: "Wedding crew",
    });
    renderWithProviders(
      <RemoveMemberDialog
        mode="team"
        member={MEMBER}
        workspaceId="ws1"
        teamId="t1"
        teamName="Wedding crew"
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove from team" }));
    await screen.findByText("Also remove Ana Cruz from the workspace?");
    fireEvent.click(screen.getByRole("button", { name: "Remove from workspace" }));

    expect(
      await screen.findByText(
        "Ana Cruz is a team lead for Wedding crew. Remove their team lead status first in order to delete them.",
      ),
    ).toBeInTheDocument();
  });

  it("from the workspace prompt, checking don't-ask-again and choosing Remove from workspace also persists the flag", async () => {
    vi.mocked(removeMemberFromTeamAction).mockResolvedValue({ ok: true });
    vi.mocked(removeMemberFromWorkspaceAction).mockResolvedValue({ ok: true });
    renderWithProviders(
      <RemoveMemberDialog
        mode="team"
        member={MEMBER}
        workspaceId="ws1"
        teamId="t1"
        teamName="Wedding crew"
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove from team" }));
    await screen.findByText("Also remove Ana Cruz from the workspace?");
    fireEvent.click(screen.getByLabelText("Don't ask me again"));
    fireEvent.click(screen.getByRole("button", { name: "Remove from workspace" }));

    await waitFor(() =>
      expect(
        window.localStorage.getItem("gw_hide_workspace_removal_prompt:ws1"),
      ).toBe("1"),
    );
  });
});

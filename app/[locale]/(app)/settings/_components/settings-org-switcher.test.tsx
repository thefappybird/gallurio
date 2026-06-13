import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test-utils/render";
import { SettingsOrgSwitcher } from "./settings-org-switcher";

// Stub the server action so it doesn't try to call the server.
vi.mock("../_actions", () => ({
  setActiveWorkspaceAction: vi.fn().mockResolvedValue(undefined),
}));

const workspaces = [
  { id: "ws_aaa", name: "Workspace A" },
  { id: "ws_bbb", name: "Workspace B" },
];

function renderSwitcher(currentWorkspaceId = "ws_aaa") {
  return renderWithProviders(
    <SettingsOrgSwitcher
      workspaces={workspaces}
      currentWorkspaceId={currentWorkspaceId}
    />,
  );
}

describe("SettingsOrgSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the trigger with the current workspace name", () => {
    renderSwitcher("ws_aaa");
    expect(screen.getByRole("button", { name: /switch workspace/i })).toBeInTheDocument();
    expect(screen.getByText("Workspace A")).toBeInTheDocument();
  });

  it("opens the menu and shows the yourWorkspaces label without throwing", () => {
    renderSwitcher("ws_aaa");
    const trigger = screen.getByRole("button", { name: /switch workspace/i });
    fireEvent.click(trigger);
    expect(screen.getByText("Your workspaces")).toBeInTheDocument();
  });

  it("lists all workspaces in the open menu", () => {
    renderSwitcher("ws_aaa");
    const trigger = screen.getByRole("button", { name: /switch workspace/i });
    fireEvent.click(trigger);
    expect(screen.getAllByText("Workspace A").length).toBeGreaterThan(0);
    expect(screen.getByText("Workspace B")).toBeInTheDocument();
  });
});

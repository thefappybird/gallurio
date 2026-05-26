/**
 * Tests for TeamsPanel.
 *
 * Covers structural rendering — no full submit flows since those require
 * real server actions and a DB. All actions are mocked.
 *
 * Uses renderWithProviders so real en.json translations are resolved.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { TeamsPanel } from "./_panel";

vi.mock("./_actions", () => ({
  createTeamAction: vi.fn(),
  renameTeamAction: vi.fn(),
  setTeamColorAction: vi.fn(),
  deleteTeamAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const DEFAULT_TEAM = {
  id: "team-default-1",
  name: "Main",
  color: "#0d7377",
  isDefault: true,
  memberCount: 3,
};

const REGULAR_TEAM = {
  id: "team-regular-1",
  name: "Wedding crew",
  color: "#7c5cff",
  isDefault: false,
  memberCount: 1,
};

const THIRD_TEAM = {
  id: "team-3",
  name: "Third",
  color: "#e87a4f",
  isDefault: false,
  memberCount: 0,
};

function renderPanel(overrides?: Partial<Parameters<typeof TeamsPanel>[0]>) {
  return renderWithProviders(
    <TeamsPanel
      teams={[DEFAULT_TEAM, REGULAR_TEAM]}
      plan="starter"
      maxTeams={3}
      {...overrides}
    />
  );
}

describe("TeamsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the section title", () => {
    renderPanel();
    // en.json: app.settings.teams.title = "Teams"
    expect(screen.getByRole("heading", { name: "Teams" })).toBeInTheDocument();
  });

  it("renders the Create team button", () => {
    renderPanel();
    // en.json: app.settings.teams.createButton = "Create team"
    const btn = screen.getByRole("button", { name: /create team/i });
    expect(btn).toBeInTheDocument();
  });

  it("shows empty state when teams list is empty", () => {
    renderWithProviders(
      <TeamsPanel teams={[]} plan="starter" maxTeams={3} />
    );
    // en.json: app.settings.teams.listEmpty = "You don't have any teams yet."
    expect(
      screen.getByText("You don't have any teams yet.")
    ).toBeInTheDocument();
  });

  it("does not show empty state when teams are present", () => {
    renderPanel();
    expect(
      screen.queryByText("You don't have any teams yet.")
    ).not.toBeInTheDocument();
  });

  it("renders both team names", () => {
    renderPanel();
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Wedding crew")).toBeInTheDocument();
  });

  it("renders the Default badge for the default team", () => {
    renderPanel();
    // en.json: app.settings.teams.team.defaultBadge = "Default"
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("Create team button does not have aria-disabled when under the cap", () => {
    renderPanel({ teams: [DEFAULT_TEAM], plan: "starter", maxTeams: 3 });
    const btn = screen.getByRole("button", { name: /create team/i });
    expect(btn.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("Create team button has aria-disabled at cap", () => {
    renderPanel({
      teams: [DEFAULT_TEAM, REGULAR_TEAM, THIRD_TEAM],
      plan: "starter",
      maxTeams: 3,
    });
    const btn = screen.getByRole("button", { name: /create team/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("clicking Create team at cap opens the upsell dialog", () => {
    renderPanel({
      teams: [DEFAULT_TEAM, REGULAR_TEAM, THIRD_TEAM],
      plan: "starter",
      maxTeams: 3,
    });
    const btn = screen.getByRole("button", { name: /create team/i });
    fireEvent.click(btn);
    // en.json: app.settings.teams.upsell.atCapTitle = "You've reached your team limit"
    expect(
      screen.getByText("You've reached your team limit")
    ).toBeInTheDocument();
  });

  it("clicking Create team under the cap opens the create dialog", () => {
    renderPanel({ teams: [DEFAULT_TEAM], plan: "starter", maxTeams: 3 });
    const btn = screen.getByRole("button", { name: /create team/i });
    fireEvent.click(btn);
    // en.json: app.settings.teams.createDialog.title = "Create team"
    // There will be two "Create team" texts: the button we clicked + the dialog title
    const allCreateTeam = screen.getAllByText("Create team");
    expect(allCreateTeam.length).toBeGreaterThanOrEqual(2);
  });

  it("the default team does not have a delete option in its dropdown", () => {
    renderPanel();
    // Open the dropdown for the default team (Main)
    const actionBtn = screen.getByRole("button", { name: /Actions for Main/i });
    fireEvent.click(actionBtn);
    // en.json: app.settings.teams.team.delete = "Delete"
    // The delete item should NOT be in the DOM for the default team's dropdown
    // (Only the regular team row renders the delete item)
    // After opening Main's dropdown, only its menu items are shown
    // Check that "Delete" text doesn't appear in the menu (it won't because isDefault=true)
    // The dropdown renders inline in happy-dom
    const deleteMenuItems = screen.queryAllByText("Delete");
    // No delete option for the default team's open dropdown
    // (the regular team's delete item is only shown in its own dropdown)
    expect(deleteMenuItems.length).toBe(0);
  });

  it("the regular team has a delete option in its dropdown", () => {
    renderPanel();
    const actionBtn = screen.getByRole("button", {
      name: /Actions for Wedding crew/i,
    });
    fireEvent.click(actionBtn);
    // en.json: app.settings.teams.team.delete = "Delete"
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });
});

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { InviteForm, type InvitableTeam } from "./invite-form";

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("../_invite-action", () => ({
  inviteMemberAction: vi.fn(),
}));

const TEAM_WITH_LEAD: InvitableTeam = {
  id: "team-1",
  name: "Wedding Crew",
  color: "#123456",
  memberCount: 2,
  maxMembersPerTeam: 10,
  hasLead: true,
};

const TEAM_WITHOUT_LEAD: InvitableTeam = {
  id: "team-2",
  name: "Second Crew",
  color: "#654321",
  memberCount: 1,
  maxMembersPerTeam: 10,
  hasLead: false,
};

describe("InviteForm", () => {
  it("disables the lead toggle when the selected team already has a lead", async () => {
    renderWithProviders(
      <InviteForm
        teams={[TEAM_WITH_LEAD]}
        open
        onOpenChange={vi.fn()}
        defaultTeamIds={["team-1"]}
      />,
    );

    const leadSwitch = screen.getByRole("switch", { name: "Lead" });
    await waitFor(() => {
      expect(leadSwitch).toHaveAttribute("aria-disabled", "true");
    });
  });

  it("keeps the lead toggle enabled for selected teams without a lead", async () => {
    renderWithProviders(
      <InviteForm
        teams={[TEAM_WITHOUT_LEAD]}
        open
        onOpenChange={vi.fn()}
        defaultTeamIds={["team-2"]}
      />,
    );

    const teamCheckbox = screen.getByRole("checkbox");
    const leadSwitch = screen.getByRole("switch", { name: "Lead" });
    await waitFor(() => {
      expect(teamCheckbox).toBeChecked();
      expect(leadSwitch).not.toHaveAttribute("aria-disabled");
    });

    fireEvent.click(leadSwitch);
    await waitFor(() => {
      expect(leadSwitch).toHaveAttribute("aria-checked", "true");
    });
  });
});

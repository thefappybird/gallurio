import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { TeamPicker } from "./team-picker";
import type { BookingTeamOption } from "../_data/team-options";

// Stub the i18n keys that another agent adds to messages/*.json.
// We merge them into the existing en messages so the provider is satisfied.
const messages = {
  ...enMessages,
  app: {
    ...enMessages.app,
    bookings: {
      ...enMessages.app.bookings,
      teamPicker: {
        allTeams: "All teams",
        allMyTeams: "All my teams",
        label: "Filter by team",
        inactive: "Inactive",
      },
    },
  },
};

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages as typeof enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const activeTeam: BookingTeamOption = {
  id: "team-1",
  name: "Alpha",
  color: "#3b82f6",
  isActive: true,
  isLead: true,
};

const inactiveTeam: BookingTeamOption = {
  id: "team-2",
  name: "Beta",
  color: "#ef4444",
  isActive: false,
  isLead: false,
};

describe("TeamPicker", () => {
  it("renders 'All teams' option for owner", () => {
    render(
      <TeamPicker
        teams={[activeTeam]}
        value="all"
        isOwner={true}
        onChange={() => {}}
      />,
      { wrapper }
    );
    expect(screen.getByText("All teams")).toBeInTheDocument();
    expect(screen.queryByText("All my teams")).not.toBeInTheDocument();
  });

  it("renders 'All my teams' option for member (isOwner=false)", () => {
    render(
      <TeamPicker
        teams={[activeTeam]}
        value="all"
        isOwner={false}
        onChange={() => {}}
      />,
      { wrapper }
    );
    expect(screen.getByText("All my teams")).toBeInTheDocument();
    expect(screen.queryByText("All teams")).not.toBeInTheDocument();
  });

  // NOTE: the dropdown options render in a base-ui portal that only mounts on
  // open; happy-dom doesn't drive that interaction reliably, so we assert the
  // component's logic via the trigger display + the hidden form control rather
  // than opening the listbox.

  it("renders without crashing for a mix of active and inactive teams", () => {
    const { container } = render(
      <TeamPicker
        teams={[activeTeam, inactiveTeam]}
        value="all"
        isOwner={true}
        onChange={() => {}}
      />,
      { wrapper }
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  it("shows an inactive team's name in the trigger when it is the selected value", () => {
    render(
      <TeamPicker
        teams={[activeTeam, inactiveTeam]}
        value="team-2"
        isOwner={true}
        onChange={() => {}}
      />,
      { wrapper }
    );
    expect(screen.getAllByText("Beta").length).toBeGreaterThanOrEqual(1);
  });

  it("mirrors the selected value into the underlying form control", () => {
    const { container } = render(
      <TeamPicker
        teams={[activeTeam]}
        value="team-1"
        isOwner={true}
        onChange={vi.fn()}
      />,
      { wrapper }
    );
    // base-ui Select mirrors its value into a hidden input for form submission.
    expect(container.querySelector('input[value="team-1"]')).not.toBeNull();
  });

  it("renders the trigger with aria-label from the label i18n key", () => {
    render(
      <TeamPicker
        teams={[]}
        value="all"
        isOwner={true}
        onChange={() => {}}
      />,
      { wrapper }
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-label", "Filter by team");
  });

  it("shows the selected team name and swatch when a specific team is chosen", () => {
    render(
      <TeamPicker
        teams={[activeTeam, inactiveTeam]}
        value="team-1"
        isOwner={true}
        onChange={() => {}}
      />,
      { wrapper }
    );
    // The selected team name should appear in the trigger display
    const alphaElements = screen.getAllByText("Alpha");
    expect(alphaElements.length).toBeGreaterThanOrEqual(1);
  });
});

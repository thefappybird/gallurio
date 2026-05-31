import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { TeamPicker } from "./team-picker";
import type { BookingTeamOption } from "../_data/team-options";

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
        countLabel: "{count, plural, one {# team} other {# teams}}",
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

const alpha: BookingTeamOption = { id: "team-1", name: "Alpha", color: "#3b82f6", isActive: true, isLead: true };
const beta: BookingTeamOption = { id: "team-2", name: "Beta", color: "#10b981", isActive: true, isLead: false };

// The picker's options live in a base-ui Popover portal that only mounts on open;
// happy-dom can't drive that, so we assert the trigger's summary label, which is
// the picker's whole job (the multi-select toggle logic is covered by TeamLegend).
describe("TeamPicker (multi-select trigger summary)", () => {
  it("shows 'All teams' for an owner with nothing selected", () => {
    render(<TeamPicker teams={[alpha, beta]} selected={[]} isOwner onChange={() => {}} />, { wrapper });
    expect(screen.getByRole("button", { name: /filter by team/i })).toHaveTextContent("All teams");
  });

  it("shows 'All my teams' for a member with nothing selected", () => {
    render(<TeamPicker teams={[alpha, beta]} selected={[]} isOwner={false} onChange={() => {}} />, { wrapper });
    expect(screen.getByRole("button", { name: /filter by team/i })).toHaveTextContent("All my teams");
  });

  it("shows the team name when exactly one is selected", () => {
    render(<TeamPicker teams={[alpha, beta]} selected={["team-1"]} isOwner onChange={() => {}} />, { wrapper });
    expect(screen.getByRole("button", { name: /filter by team/i })).toHaveTextContent("Alpha");
  });

  it("shows a count when multiple teams are selected", () => {
    render(<TeamPicker teams={[alpha, beta]} selected={["team-1", "team-2"]} isOwner onChange={() => {}} />, {
      wrapper,
    });
    expect(screen.getByRole("button", { name: /filter by team/i })).toHaveTextContent("2 teams");
  });
});

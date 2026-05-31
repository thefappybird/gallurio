import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { TeamLegend } from "./team-legend";
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
const retired: BookingTeamOption = { id: "team-2", name: "Beta", color: "#ef4444", isActive: false, isLead: false };

describe("TeamLegend", () => {
  it("shows 'All teams' for an owner and 'All my teams' for a member", () => {
    const { rerender } = render(
      <TeamLegend teams={[alpha]} value="all" isOwner onSelect={() => {}} />,
      { wrapper },
    );
    expect(screen.getByRole("button", { name: "All teams" })).toBeInTheDocument();

    rerender(<TeamLegend teams={[alpha]} value="all" isOwner={false} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "All my teams" })).toBeInTheDocument();
  });

  it("renders active and inactive teams as clickable chips", () => {
    render(<TeamLegend teams={[alpha, retired]} value="all" isOwner onSelect={() => {}} />, { wrapper });
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Beta/ })).toBeInTheDocument();
  });

  it("selects a team by id when its chip is clicked", () => {
    const onSelect = vi.fn();
    render(<TeamLegend teams={[alpha]} value="all" isOwner onSelect={onSelect} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(onSelect).toHaveBeenCalledWith("team-1");
  });

  it("clicking the already-active team clears back to 'all'", () => {
    const onSelect = vi.fn();
    render(<TeamLegend teams={[alpha]} value="team-1" isOwner onSelect={onSelect} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(onSelect).toHaveBeenCalledWith("all");
  });

  it("marks the active chip with aria-pressed", () => {
    render(<TeamLegend teams={[alpha]} value="team-1" isOwner onSelect={() => {}} />, { wrapper });
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All teams" })).toHaveAttribute("aria-pressed", "false");
  });
});

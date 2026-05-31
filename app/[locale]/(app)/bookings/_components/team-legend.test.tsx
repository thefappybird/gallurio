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
const retired: BookingTeamOption = { id: "team-3", name: "Gamma", color: "#ef4444", isActive: false, isLead: false };

describe("TeamLegend (multi-select)", () => {
  it("shows 'All teams' (owner) / 'All my teams' (member)", () => {
    const { rerender } = render(
      <TeamLegend teams={[alpha]} selected={[]} isOwner onChange={() => {}} />,
      { wrapper },
    );
    expect(screen.getByRole("button", { name: "All teams" })).toBeInTheDocument();
    rerender(<TeamLegend teams={[alpha]} selected={[]} isOwner={false} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "All my teams" })).toBeInTheDocument();
  });

  it("renders active and inactive teams", () => {
    render(<TeamLegend teams={[alpha, retired]} selected={[]} isOwner onChange={() => {}} />, { wrapper });
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gamma/ })).toBeInTheDocument();
  });

  it("adds a team to an empty selection", () => {
    const onChange = vi.fn();
    render(<TeamLegend teams={[alpha, beta]} selected={[]} isOwner onChange={onChange} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(onChange).toHaveBeenCalledWith(["team-1"]);
  });

  it("ADDS a second team to an existing selection (multi-select)", () => {
    const onChange = vi.fn();
    render(<TeamLegend teams={[alpha, beta]} selected={["team-1"]} isOwner onChange={onChange} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Beta/ }));
    expect(onChange).toHaveBeenCalledWith(["team-1", "team-2"]);
  });

  it("removes a team that is already selected", () => {
    const onChange = vi.fn();
    render(<TeamLegend teams={[alpha, beta]} selected={["team-1", "team-2"]} isOwner onChange={onChange} />, {
      wrapper,
    });
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(onChange).toHaveBeenCalledWith(["team-2"]);
  });

  it("clicking 'All teams' clears the selection", () => {
    const onChange = vi.fn();
    render(<TeamLegend teams={[alpha]} selected={["team-1"]} isOwner onChange={onChange} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: "All teams" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("marks selected chips (and 'All' when empty) via aria-pressed", () => {
    const { rerender } = render(
      <TeamLegend teams={[alpha, beta]} selected={[]} isOwner onChange={() => {}} />,
      { wrapper },
    );
    expect(screen.getByRole("button", { name: "All teams" })).toHaveAttribute("aria-pressed", "true");

    rerender(<TeamLegend teams={[alpha, beta]} selected={["team-1"]} isOwner onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Beta/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "All teams" })).toHaveAttribute("aria-pressed", "false");
  });
});

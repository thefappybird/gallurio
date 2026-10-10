import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { filMessages } from "@/test-utils/messages";
import { TeamFilterControl } from "./team-filter-control";
import type { BookingTeamOption } from "../_data/team-options";

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const TEAMS: BookingTeamOption[] = Array.from({ length: 30 }, (_, i) => ({
  id: `team-${i}`,
  name: `Team ${i}`,
  color: "#0ea5e9",
  isActive: true,
  isLead: false,
}));

describe("TeamFilterControl legend", () => {
  it("labels the popover trigger Legend", () => {
    renderWithProviders(
      <TeamFilterControl teams={TEAMS} selected={[]} isOwner onChange={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Legend" })).toBeInTheDocument();
  });

  it("renders a non-button Conflicted key before the team chips when teamed", () => {
    renderWithProviders(
      <TeamFilterControl teams={TEAMS.slice(0, 2)} selected={[]} isOwner onChange={vi.fn()} />
    );
    const key = screen.getAllByText("Conflicted")[0];
    expect(key.closest("button")).toBeNull();
    const allTeams = screen.getAllByRole("button", { name: "All teams" })[0];
    expect(key.compareDocumentPosition(allTeams) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows only Booked and Conflicted keys, no team filter or Inquiry, when teamless", () => {
    renderWithProviders(
      <TeamFilterControl teams={TEAMS.slice(0, 1)} selected={[]} isOwner onChange={vi.fn()} />
    );
    expect(screen.getByText("Booked")).toBeInTheDocument();
    expect(screen.getByText("Conflicted")).toBeInTheDocument();
    expect(screen.queryByText("Inquiry")).toBeNull();
    expect(screen.queryByRole("button", { name: "All teams" })).toBeNull();
  });
});

describe("TeamFilterControl pagination", () => {
  it("labels the page buttons in the active locale", () => {
    renderWithProviders(
      <TeamFilterControl teams={TEAMS} selected={[]} isOwner onChange={vi.fn()} />,
      { locale: "fil", messages: filMessages as never }
    );
    expect(screen.getByRole("button", { name: "Nakaraang pahina" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Susunod na pahina" })).toBeInTheDocument();
  });
});

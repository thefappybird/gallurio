import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import filMessages from "@/messages/fil.json";
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

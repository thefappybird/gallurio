import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { CreateDialog, EditDialog } from "./team-dialogs";
import type { TeamRow } from "../_types";

vi.mock("../_actions", () => ({
  createTeamAction: vi.fn(),
  renameTeamAction: vi.fn(),
  setTeamColorAction: vi.fn(),
  deactivateTeamAction: vi.fn(),
  reactivateTeamAction: vi.fn(),
}));

describe("CreateDialog", () => {
  it("marks the name input invalid with a describedby-linked alert when submitted blank", () => {
    renderWithProviders(
      <CreateDialog
        open
        onOpenChange={vi.fn()}
        onCreated={vi.fn()}
        onCapExceeded={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Team name");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!);
    expect(message).toHaveAttribute("role", "alert");
    expect(message).toHaveTextContent("Team name is required.");
  });

  it("rejects a 41-character name as too long, reusing the shared 40-char schema rule", () => {
    renderWithProviders(
      <CreateDialog
        open
        onOpenChange={vi.fn()}
        onCreated={vi.fn()}
        onCapExceeded={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Team name");
    const tooLong = "a".repeat(41);
    fireEvent.change(input, { target: { value: tooLong } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Team name must be 40 characters or fewer.",
    );
  });

  it("keeps the name input valid (no aria-invalid, no alert) while untouched", () => {
    renderWithProviders(
      <CreateDialog
        open
        onOpenChange={vi.fn()}
        onCreated={vi.fn()}
        onCapExceeded={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Team name");
    fireEvent.change(input, { target: { value: "Wedding Crew" } });

    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

const TEAM: TeamRow = {
  id: "team-1",
  name: "Wedding Crew",
  color: "#123456",
  isDefault: false,
  isActive: true,
  memberCount: 2,
};

describe("EditDialog", () => {
  it("marks the name input invalid with a describedby-linked alert when cleared", () => {
    renderWithProviders(
      <EditDialog
        team={TEAM}
        open
        onOpenChange={vi.fn()}
        onRenamed={vi.fn()}
        onColorChanged={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Team name");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!);
    expect(message).toHaveAttribute("role", "alert");
    expect(message).toHaveTextContent("Team name is required.");
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DraftNameEditor } from "./DraftNameEditor";

describe("DraftNameEditor", () => {
  it("shows the name and a pencil button in read mode", () => {
    render(<DraftNameEditor name="New Draft" onCommit={vi.fn()} error={null} />);
    expect(screen.getByText("New Draft")).toBeTruthy();
    expect(screen.getByRole("button", { name: /rename draft/i })).toBeTruthy();
  });

  it("edits then commits the new name", () => {
    const onCommit = vi.fn();
    render(<DraftNameEditor name="New Draft" onCommit={onCommit} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: /rename draft/i }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Spring Wedding" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm name/i }));
    expect(onCommit).toHaveBeenCalledWith("Spring Wedding");
  });

  it("cancel restores the original name without committing", () => {
    const onCommit = vi.fn();
    render(<DraftNameEditor name="New Draft" onCommit={onCommit} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: /rename draft/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Throwaway" } });
    fireEvent.click(screen.getByRole("button", { name: /cancel rename/i }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText("New Draft")).toBeTruthy();
  });

  it("renders an inline error", () => {
    render(<DraftNameEditor name="New Draft" onCommit={vi.fn()} error="A draft with this name already exists" />);
    expect(screen.getByRole("alert").textContent).toMatch(/already exists/i);
  });
});

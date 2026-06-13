import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { DraftsDialog } from "./DraftsDialog";
import type { DraftSummary } from "../_draftActions";

const drafts: DraftSummary[] = [
  { id: "a", name: "Spring", templateId: "minimal", updatedAt: new Date().toISOString() },
  { id: "b", name: "Bold", templateId: "scratch", updatedAt: new Date().toISOString() },
];

function setup(props: Partial<React.ComponentProps<typeof DraftsDialog>> = {}) {
  return renderWithProviders(
    <DraftsDialog
      open
      onOpenChange={vi.fn()}
      drafts={drafts}
      activeDraftId="a"
      onApply={vi.fn()}
      onDelete={vi.fn()}
      onAddNew={vi.fn()}
      {...props}
    />
  );
}

describe("DraftsDialog", () => {
  it("lists drafts and marks the active one", () => {
    setup();
    expect(screen.getByText("Spring")).toBeTruthy();
    expect(screen.getByText("Bold")).toBeTruthy();
    expect(screen.getByText(/active/i)).toBeTruthy();
  });

  it("shows empty-state copy and Add new draft when there are no drafts", () => {
    const onAddNew = vi.fn();
    setup({ drafts: [], activeDraftId: null, onAddNew });
    expect(screen.getByText(/no drafts yet/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /add new draft/i }));
    expect(onAddNew).toHaveBeenCalled();
  });

  it("renders Apply and Delete as icon-only buttons and fires onApply", () => {
    const onApply = vi.fn();
    setup({ onApply });
    const applyBtn = screen.getByRole("button", { name: "Apply Bold" });
    // Icon-only: SVG child present, no visible "Apply" text.
    expect(applyBtn.querySelector("svg")).toBeTruthy();
    expect(applyBtn).not.toHaveTextContent("Apply");
    const deleteBtn = screen.getByRole("button", { name: "Delete Bold" });
    expect(deleteBtn.querySelector("svg")).toBeTruthy();
    fireEvent.click(applyBtn);
    expect(onApply).toHaveBeenCalledWith("b");
  });

  it("routes Delete through the confirm AlertDialog then calls onDelete", () => {
    const onDelete = vi.fn();
    setup({ onDelete });
    fireEvent.click(screen.getByRole("button", { name: "Delete Bold" }));
    // Confirm dialog appears.
    expect(screen.getByText("Delete this draft?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^delete draft$/i }));
    expect(onDelete).toHaveBeenCalledWith("b");
  });
});

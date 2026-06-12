import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DraftsDialog } from "./DraftsDialog";
import type { DraftSummary } from "../_draftActions";

const drafts: DraftSummary[] = [
  { id: "a", name: "Spring", templateId: "minimal", updatedAt: new Date().toISOString() },
  { id: "b", name: "Bold", templateId: "scratch", updatedAt: new Date().toISOString() },
];

function setup(props: Partial<React.ComponentProps<typeof DraftsDialog>> = {}) {
  return render(
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

  it("applies a draft", () => {
    const onApply = vi.fn();
    setup({ onApply });
    fireEvent.click(screen.getByRole("button", { name: /apply Bold/i }));
    expect(onApply).toHaveBeenCalledWith("b");
  });

  it("confirms before deleting", () => {
    const onDelete = vi.fn();
    setup({ onDelete });
    fireEvent.click(screen.getByRole("button", { name: /delete Bold/i }));
    fireEvent.click(screen.getByRole("button", { name: /^delete draft$/i }));
    expect(onDelete).toHaveBeenCalledWith("b");
  });
});

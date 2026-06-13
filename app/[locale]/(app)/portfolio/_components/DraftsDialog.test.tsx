import { it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { DraftsDialog } from "./DraftsDialog";

const drafts = [{ id: "d1", name: "Summer", templateId: "minimal", updatedAt: new Date().toISOString() }];

it("renders Apply and Delete as labeled icon buttons and fires their handlers", () => {
  const onApply = vi.fn();
  const onDelete = vi.fn();
  renderWithProviders(
    <DraftsDialog
      open
      onOpenChange={() => {}}
      drafts={drafts}
      activeDraftId={null}
      onApply={onApply}
      onDelete={onDelete}
      onAddNew={() => {}}
    />
  );

  const applyBtn = screen.getByRole("button", { name: "Apply Summer" });
  const deleteBtn = screen.getByRole("button", { name: "Delete Summer" });
  // Icon-only: an SVG child, no visible "Apply"/"Delete" text.
  expect(applyBtn.querySelector("svg")).toBeTruthy();
  expect(applyBtn).not.toHaveTextContent("Apply");
  expect(deleteBtn.querySelector("svg")).toBeTruthy();

  fireEvent.click(applyBtn);
  expect(onApply).toHaveBeenCalledWith("d1");

  // Delete still routes through the confirm dialog.
  fireEvent.click(deleteBtn);
  expect(screen.getByText("Delete this draft?")).toBeInTheDocument();
});

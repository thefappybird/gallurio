import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { UnsavedEditDialog } from "./UnsavedEditDialog";

describe("UnsavedEditDialog", () => {
  it("fires discard and save-and-close", () => {
    const onDiscard = vi.fn();
    const onSaveAndClose = vi.fn();
    renderWithProviders(
      <UnsavedEditDialog open title="Unsaved changes" body="Save your edits?"
        discardLabel="Discard" saveLabel="Save & close"
        onDiscard={onDiscard} onSaveAndClose={onSaveAndClose} onOpenChange={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Save & close" }));
    expect(onSaveAndClose).toHaveBeenCalledTimes(1);
  });

  it("shows an inline error and disables save while saving", () => {
    renderWithProviders(
      <UnsavedEditDialog open title="Unsaved changes" body="Save?"
        discardLabel="Discard" saveLabel="Save & close" saving error="a theme already exists with this name"
        onDiscard={() => {}} onSaveAndClose={() => {}} onOpenChange={() => {}} />
    );
    expect(screen.getByText("a theme already exists with this name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save & close" })).toBeDisabled();
  });
});

import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

describe("UnsavedChangesDialog", () => {
  it("fires save / discard / cancel", () => {
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <UnsavedChangesDialog open onSave={onSave} onDiscard={onDiscard} onCancel={onCancel} saving={false} />
    );
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    fireEvent.click(screen.getByRole("button", { name: /discard/i }));
    fireEvent.click(screen.getByRole("button", { name: /keep editing/i }));
    expect(onSave).toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("renders the name Input seeded with the provided name when name and onNameChange are supplied", () => {
    const onNameChange = vi.fn();
    renderWithProviders(
      <UnsavedChangesDialog
        open
        saving={false}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
        name="My Draft"
        onNameChange={onNameChange}
        nameLabel="Draft name"
      />
    );
    const input = screen.getByLabelText("Draft name");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("My Draft");
    fireEvent.change(input, { target: { value: "Renamed" } });
    expect(onNameChange).toHaveBeenCalledWith("Renamed");
  });

  it("keeps all three actions on one row and renders the error below that row", () => {
    renderWithProviders(
      <UnsavedChangesDialog
        open
        saving={false}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
        name="My Draft"
        onNameChange={vi.fn()}
        nameLabel="Draft name"
        nameError="A draft with this name already exists"
      />
    );
    const alert = screen.getByRole("alert");
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    const keepEditing = screen.getByRole("button", { name: /keep editing/i });

    // Every action is a direct sibling in the one footer row, so the row's
    // flex sizing applies to all of them...
    expect(saveBtn.parentElement).toBe(keepEditing.parentElement);
    // ...and the error text sits AFTER that row rather than inside it, where
    // its width used to squeeze the buttons and push Save onto its own line.
    expect(alert.parentElement).not.toBe(saveBtn.parentElement);
    expect(
      saveBtn.parentElement!.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(alert).toHaveTextContent("A draft with this name already exists");
    expect(saveBtn).toBeDisabled();
  });
});

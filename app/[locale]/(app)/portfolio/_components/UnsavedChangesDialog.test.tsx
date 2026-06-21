import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

describe("UnsavedChangesDialog", () => {
  it("fires save / discard / cancel", () => {
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    const onCancel = vi.fn();
    render(
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
    render(
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

  it("renders a role=alert error above Save and disables Save when nameError is set", () => {
    render(
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
    expect(alert).toHaveTextContent("A draft with this name already exists");
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    expect(saveBtn).toBeDisabled();
  });
});

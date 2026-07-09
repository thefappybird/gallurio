import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

describe("UnsavedChangesDialog", () => {
  it("renders title and body when open", () => {
    renderWithProviders(
      <UnsavedChangesDialog open={true} onKeepEditing={vi.fn()} onDiscard={vi.fn()} />
    );
    expect(screen.getAllByText(/discard/i).length).toBeGreaterThan(0);
  });

  it("clamps dialog height to the viewport and lets the body scroll independently", () => {
    renderWithProviders(
      <UnsavedChangesDialog open={true} onKeepEditing={vi.fn()} onDiscard={vi.fn()} />
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dialog.className).toContain("flex-col");
    const body = dialog.querySelector(".overflow-y-auto");
    expect(body).not.toBeNull();
    expect(body!.className).toContain("min-h-0");
    expect(body!.className).toContain("flex-1");
  });

  it("calls onKeepEditing when Keep editing clicked", () => {
    const onKeepEditing = vi.fn();
    renderWithProviders(
      <UnsavedChangesDialog open={true} onKeepEditing={onKeepEditing} onDiscard={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /keep/i }));
    expect(onKeepEditing).toHaveBeenCalledOnce();
  });

  it("calls onDiscard when Discard clicked", () => {
    const onDiscard = vi.fn();
    renderWithProviders(
      <UnsavedChangesDialog open={true} onKeepEditing={vi.fn()} onDiscard={onDiscard} />
    );
    fireEvent.click(screen.getByRole("button", { name: /discard/i }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("does not render dialog content when closed", () => {
    renderWithProviders(
      <UnsavedChangesDialog open={false} onKeepEditing={vi.fn()} onDiscard={vi.fn()} />
    );
    expect(screen.queryByText(/discard/i)).not.toBeInTheDocument();
  });
});

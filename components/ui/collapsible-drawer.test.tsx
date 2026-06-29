import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { CollapsibleDrawer } from "./collapsible-drawer";

describe("CollapsibleDrawer", () => {
  it("toggles its body from the header button", () => {
    renderWithProviders(
      <CollapsibleDrawer title="Session 1">
        <div>Drawer body</div>
      </CollapsibleDrawer>
    );

    expect(screen.queryByText("Drawer body")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /session 1/i }));
    expect(screen.getByText("Drawer body")).toBeInTheDocument();
  });

  it("calls onOpenChange when toggled", () => {
    const onOpenChange = vi.fn();

    renderWithProviders(
      <CollapsibleDrawer title="Session 2" onOpenChange={onOpenChange}>
        <div>Drawer body</div>
      </CollapsibleDrawer>
    );

    fireEvent.click(screen.getByRole("button", { name: /session 2/i }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});

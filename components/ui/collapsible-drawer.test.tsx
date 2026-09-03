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

    const header = screen.getByRole("button", { name: /session 1/i });
    expect(header.className).toContain("cursor-pointer");
    fireEvent.click(header);
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

  it("toggles from Enter and Space on the header", () => {
    const onOpenChange = vi.fn();

    renderWithProviders(
      <CollapsibleDrawer title="Session 3" onOpenChange={onOpenChange}>
        <div>Drawer body</div>
      </CollapsibleDrawer>
    );

    const header = screen.getByRole("button", { name: /session 3/i });
    fireEvent.keyDown(header, { key: "Enter" });
    fireEvent.keyDown(header, { key: " " });
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it("does not toggle when Space is pressed inside a nested input", () => {
    const onOpenChange = vi.fn();

    renderWithProviders(
      <CollapsibleDrawer
        title={<input aria-label="drawer title" defaultValue="Session 4" />}
        onOpenChange={onOpenChange}
      >
        <div>Drawer body</div>
      </CollapsibleDrawer>
    );

    const input = screen.getByLabelText("drawer title");
    fireEvent.keyDown(input, { key: " " });
    fireEvent.click(input);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

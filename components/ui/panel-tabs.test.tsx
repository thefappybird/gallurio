import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PanelTabs } from "./panel-tabs";

describe("PanelTabs", () => {
  it("marks only the active tab selected and reports clicks", () => {
    const onChange = vi.fn();
    render(
      <PanelTabs
        tabs={[
          { id: "components", label: "Components" },
          { id: "outline", label: "Outline" },
        ]}
        value="components"
        onChange={onChange}
      />
    );

    expect(screen.getByRole("button", { name: "Components" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const outline = screen.getByRole("button", { name: "Outline" });
    expect(outline).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(outline);
    expect(onChange).toHaveBeenCalledWith("outline");
  });
});

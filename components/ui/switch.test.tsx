import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { Switch } from "./switch";

describe("Switch", () => {
  it("renders and fires onCheckedChange when toggled", () => {
    const handler = vi.fn();
    renderWithProviders(<Switch onCheckedChange={handler} />);
    const sw = screen.getByRole("switch");
    fireEvent.click(sw);
    expect(handler).toHaveBeenCalledWith(true, expect.anything());
  });

  it("respects the controlled checked prop", () => {
    renderWithProviders(<Switch checked={true} onCheckedChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });
});

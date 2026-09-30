import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsLoading from "./loading";

describe("SettingsLoading", () => {
  it("reserves the real tab rail's icon-over-label mobile layout and desktop row layout", () => {
    render(<SettingsLoading />);
    const chips = screen.getAllByTestId("settings-tab-chip-skeleton");
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip).toHaveClass("flex-col");
      expect(chip).toHaveClass("sm:flex-row");
      expect(chip).toHaveClass("border-b-2");
      expect(chip).toHaveClass("border-transparent");
    }
  });
});

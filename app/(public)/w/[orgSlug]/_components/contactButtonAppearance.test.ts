import { describe, it, expect } from "vitest";
import { buildButtonStyle, buildButtonVisualStyle, type ButtonAppearance } from "./contactButtonAppearance";

const APP: ButtonAppearance = {
  color: "#123456",
  style: "solid",
  borderRadius: "0.5rem",
};

describe("buildButtonVisualStyle", () => {
  it("keeps the visual look (color/background/border-radius) but drops layout sizing", () => {
    const full = buildButtonStyle(APP, false);
    const visual = buildButtonVisualStyle(APP, false);

    // Visual props are preserved (so the control adopts the submit button's look)
    expect(visual.backgroundColor).toBe(full.backgroundColor);
    expect(visual.borderRadius).toBe(full.borderRadius);
    expect(visual.color).toBe(full.color);

    // Sizing props are dropped so the host control keeps its own size
    expect(visual.width).toBeUndefined();
    expect(visual.minHeight).toBeUndefined();
    expect(visual.fontSize).toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";
import { buildButtonStyle, buildButtonVisualStyle, resolveContactColor, resolveSubmitAppearance, type ButtonAppearance } from "./contactButtonAppearance";

const APP: ButtonAppearance = {
  color: "#123456",
  style: "solid",
  borderRadius: "0.5rem",
};

describe("resolveContactColor", () => {
  it("maps background token to --pf-color-bg var", () => {
    expect(resolveContactColor("background", "FB")).toBe("var(--pf-color-bg, FB)");
  });

  it("maps all tokens and passthroughs correctly", () => {
    expect(resolveContactColor("foreground", "FB")).toBe("var(--pf-color-fg, FB)");
    expect(resolveContactColor("primary", "FB")).toBe("var(--pf-color-primary, FB)");
    expect(resolveContactColor("#abc", "FB")).toBe("#abc");
    expect(resolveContactColor(undefined, "FB")).toBe("FB");
  });
});

describe("resolveSubmitAppearance errorColor", () => {
  it("defaults errorColor to CRM destructive hex when errorMessageColor is unset", () => {
    const result = resolveSubmitAppearance({});
    expect(result.errorColor).toBe("#e7000b");
  });
});

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

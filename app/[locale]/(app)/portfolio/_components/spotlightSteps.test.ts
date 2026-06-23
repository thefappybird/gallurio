import { describe, it, expect } from "vitest";
import { SPOTLIGHT_STEPS } from "./spotlightSteps";

describe("SPOTLIGHT_STEPS", () => {
  it("style tab steps appear in Content → Design → Layout order", () => {
    const contentIdx = SPOTLIGHT_STEPS.findIndex((s) => s.id === "style-tab-content");
    const designIdx = SPOTLIGHT_STEPS.findIndex((s) => s.id === "style-tab-design");
    const layoutIdx = SPOTLIGHT_STEPS.findIndex((s) => s.id === "style-tab-layout");

    expect(contentIdx).toBeGreaterThan(-1);
    expect(designIdx).toBeGreaterThan(-1);
    expect(layoutIdx).toBeGreaterThan(-1);

    expect(contentIdx).toBeLessThan(designIdx);
    expect(designIdx).toBeLessThan(layoutIdx);
  });

  it("step 2 (drag-block) is non-gated and has no passthrough (1b fix)", () => {
    const step = SPOTLIGHT_STEPS.find((s) => s.id === "drag-block");
    expect(step).toBeDefined();
    // Must not be gated — user can press Next without performing a drag
    expect(step?.gated).toBeFalsy();
    // Must not require passthrough — no drag gate needed
    expect(step?.passthrough).toBeFalsy();
    // Should still anchor to the blocks panel
    expect(step?.anchorId).toBe("blocks-panel");
  });

  it("step 7 (section-tabs) is non-gated and has the updated copy (1e fix)", () => {
    const step = SPOTLIGHT_STEPS.find((s) => s.id === "section-tabs");
    expect(step).toBeDefined();
    // Must not be gated — informational step
    expect(step?.gated).toBeFalsy();
    // Anchor must be the wrapper that spans all five page tabs
    expect(step?.anchorId).toBe("section-tabs");
    // Updated copy
    expect(step?.body).toContain("Switch between the different parts of your portfolio website");
  });

  it("step 8 (header-tab) remains gated (1f gate must still function)", () => {
    const step = SPOTLIGHT_STEPS.find((s) => s.id === "header-tab");
    expect(step).toBeDefined();
    expect(step?.gated).toBe(true);
    expect(step?.anchorId).toBe("header-tab");
  });
});

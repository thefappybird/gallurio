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
});

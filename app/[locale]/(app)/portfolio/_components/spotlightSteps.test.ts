import { describe, it, expect } from "vitest";
import { SPOTLIGHT_STEPS, guideStepPanel, guidePanelActions, applyGuidePanelActions, shouldResetGuideCanvasOnStep } from "./spotlightSteps";

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

  it("step 2 (drag-block) is gated (requires drag) with passthrough and anchors to blocks-panel", () => {
    const step = SPOTLIGHT_STEPS.find((s) => s.id === "drag-block");
    expect(step).toBeDefined();
    // Gated: user must drag a block to canvas before Next appears
    expect(step?.gated).toBe(true);
    // passthrough: pointer events reach the real editor so the drag works
    expect(step?.passthrough).toBe(true);
    // Anchors to the full left blocks/components panel
    expect(step?.anchorId).toBe("blocks-panel");
  });

  it("step 2 (drag-block) secondary anchor is the precise canvas viewport, not the full Puck wrapper", () => {
    const step = SPOTLIGHT_STEPS.find((s) => s.id === "drag-block");
    // "canvas-viewport" is Puck's `preview` slot (scoped to the grid's editor
    // column); "canvas" is Puck's `puck` slot (wraps the entire editor UI —
    // header/drawer/editor/fields — which would cutout almost the whole page).
    expect(step?.secondaryAnchorId).toBe("canvas-viewport");
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

  it("panel inner-tab steps use bottom placement; logo-uploader keeps left", () => {
    const bottomIds = ["header-setup-tab", "header-design-tab", "contact-setup-tab", "contact-design-tab"];
    for (const id of bottomIds) {
      const step = SPOTLIGHT_STEPS.find((s) => s.id === id);
      expect(step).toBeDefined();
      expect(step?.placement).toBe("bottom");
    }
    const logo = SPOTLIGHT_STEPS.find((s) => s.id === "logo-uploader");
    expect(logo?.placement).toBe("left");
  });

  it("step 3 (properties-panel) uses properties-panel-full anchor for full right sidebar (1c fix)", () => {
    const step = SPOTLIGHT_STEPS.find((s) => s.id === "properties-panel");
    expect(step).toBeDefined();
    // Must target the full sidebar column, not the inner fields wrapper
    expect(step?.anchorId).toBe("properties-panel-full");
    // Tooltip should be placed to the left of the right panel
    expect(step?.placement).toBe("left");
  });

  it("teaches the responsive canvas controls before preview and uses stable compact anchors", () => {
    const controlsIdx = SPOTLIGHT_STEPS.findIndex((s) => s.id === "canvas-controls");
    const previewIdx = SPOTLIGHT_STEPS.findIndex((s) => s.id === "preview-device");
    const controls = SPOTLIGHT_STEPS[controlsIdx];
    const translate = SPOTLIGHT_STEPS.find((s) => s.id === "translate");
    const actions = SPOTLIGHT_STEPS.find((s) => s.id === "save-drafts");

    expect(controlsIdx).toBeGreaterThan(-1);
    expect(controlsIdx).toBeLessThan(previewIdx);
    expect(controls.anchorId).toBe("canvas-controls");
    expect(controls.body).toContain("smaller screens");
    expect(translate?.anchorId).toBe("canvas-controls");
    expect(actions?.anchorId).toBe("workspace-actions");
  });
});

describe("guideStepPanel", () => {
  it("returns the correct panel for each step bucket", () => {
    expect(guideStepPanel("header-setup-tab")).toBe("nav");
    expect(guideStepPanel("logo-uploader")).toBe("nav");
    expect(guideStepPanel("header-design-tab")).toBe("nav");
    expect(guideStepPanel("contact-setup-tab")).toBe("contact");
    expect(guideStepPanel("contact-design-tab")).toBe("contact");
    expect(guideStepPanel("header-tab")).toBe("none");
    expect(guideStepPanel("contact-tab")).toBe("none");
    expect(guideStepPanel("drag-block")).toBe("none");
    expect(guideStepPanel(undefined)).toBe("none");
  });
});

describe("guidePanelActions", () => {
  it("returns the correct open/close flags given step id and current panel state", () => {
    // nav step + header closed -> openHeader
    expect(guidePanelActions("header-setup-tab", { headerOpen: false, contactOpen: false }))
      .toEqual({ openHeader: true, openContact: false, closeHeader: false, closeContact: false });
    // nav step + header already open -> all false (no-op)
    expect(guidePanelActions("logo-uploader", { headerOpen: true, contactOpen: false }))
      .toEqual({ openHeader: false, openContact: false, closeHeader: false, closeContact: false });
    // contact step + contact closed -> openContact
    expect(guidePanelActions("contact-setup-tab", { headerOpen: false, contactOpen: false }))
      .toEqual({ openHeader: false, openContact: true, closeHeader: false, closeContact: false });
    // none step + header open -> closeHeader
    expect(guidePanelActions("drag-block", { headerOpen: true, contactOpen: false }))
      .toEqual({ openHeader: false, openContact: false, closeHeader: true, closeContact: false });
    // none step + both closed -> all false
    expect(guidePanelActions("drag-block", { headerOpen: false, contactOpen: false }))
      .toEqual({ openHeader: false, openContact: false, closeHeader: false, closeContact: false });
  });
});

describe("shouldResetGuideCanvasOnStep", () => {
  it("returns true when navigating to drag-block with content present", () => {
    expect(shouldResetGuideCanvasOnStep("drag-block", true)).toBe(true);
  });

  it("returns false when navigating to drag-block with no content (blank canvas — no reset needed)", () => {
    expect(shouldResetGuideCanvasOnStep("drag-block", false)).toBe(false);
  });

  it("returns false for other step ids regardless of content", () => {
    expect(shouldResetGuideCanvasOnStep("properties-panel", true)).toBe(false);
  });
});

describe("applyGuidePanelActions", () => {
  it("invokes only the callbacks that correspond to true flags", () => {
    const calls: string[] = [];
    const cbs = {
      openHeader: () => calls.push("openHeader"),
      openContact: () => calls.push("openContact"),
      closeHeader: () => calls.push("closeHeader"),
      closeContact: () => calls.push("closeContact"),
    };

    // openHeader true — only openHeader should fire
    applyGuidePanelActions(
      { openHeader: true, openContact: false, closeHeader: false, closeContact: false },
      cbs,
    );
    expect(calls).toEqual(["openHeader"]);

    // closeHeader + closeContact true — opens must not fire
    calls.length = 0;
    applyGuidePanelActions(
      { openHeader: false, openContact: false, closeHeader: true, closeContact: true },
      cbs,
    );
    expect(calls).toEqual(["closeHeader", "closeContact"]);
  });
});

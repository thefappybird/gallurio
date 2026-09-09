import { describe, it, expect } from "vitest";
import { computeAnchoredPanelPosition } from "./anchoredPanelPosition";

const VIEWPORT = { viewportWidth: 1280, viewportHeight: 800 };

describe("computeAnchoredPanelPosition", () => {
  it("prefers the physical right for preferredSide=end in ltr", () => {
    const pos = computeAnchoredPanelPosition({
      anchorRect: { top: 100, left: 200, right: 260, bottom: 140 },
      panelWidth: 280,
      panelMaxHeight: 320,
      gap: 8,
      preferredSide: "end",
      dir: "ltr",
      ...VIEWPORT,
    });
    expect(pos.left).toBe(260 + 8);
  });

  it("falls back to the left when the physical-right side does not fit", () => {
    const pos = computeAnchoredPanelPosition({
      anchorRect: { top: 100, left: 1100, right: 1200, bottom: 140 },
      panelWidth: 280,
      panelMaxHeight: 320,
      gap: 8,
      preferredSide: "end",
      dir: "ltr",
      ...VIEWPORT,
    });
    expect(pos.left).toBe(1100 - 280 - 8);
  });

  it("prefers the physical left for preferredSide=start in ltr", () => {
    const pos = computeAnchoredPanelPosition({
      anchorRect: { top: 100, left: 1000, right: 1060, bottom: 140 },
      panelWidth: 240,
      panelMaxHeight: 200,
      gap: 8,
      preferredSide: "start",
      dir: "ltr",
      ...VIEWPORT,
    });
    expect(pos.left).toBe(1000 - 240 - 8);
  });

  it("falls back to the right when the physical-left side does not fit", () => {
    const pos = computeAnchoredPanelPosition({
      anchorRect: { top: 100, left: 20, right: 80, bottom: 140 },
      panelWidth: 240,
      panelMaxHeight: 200,
      gap: 8,
      preferredSide: "start",
      dir: "ltr",
      ...VIEWPORT,
    });
    expect(pos.left).toBe(80 + 8);
  });

  it("mirrors start/end in rtl", () => {
    const pos = computeAnchoredPanelPosition({
      anchorRect: { top: 100, left: 200, right: 260, bottom: 140 },
      panelWidth: 240,
      panelMaxHeight: 200,
      gap: 8,
      preferredSide: "start",
      dir: "rtl",
      ...VIEWPORT,
    });
    // start = physical right in rtl
    expect(pos.left).toBe(260 + 8);
  });

  it("clamps vertically so the panel stays inside the viewport", () => {
    const pos = computeAnchoredPanelPosition({
      anchorRect: { top: 780, left: 200, right: 260, bottom: 800 },
      panelWidth: 240,
      panelMaxHeight: 200,
      gap: 8,
      preferredSide: "end",
      dir: "ltr",
      ...VIEWPORT,
    });
    expect(pos.top).toBe(800 - 200 - 8);
  });
});

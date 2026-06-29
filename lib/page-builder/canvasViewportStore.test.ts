import { describe, it, expect } from "vitest";
import { stepZoom, CANVAS_ZOOM_STEPS } from "./canvasViewportStore";

describe("stepZoom", () => {
  it("moves to the neighbouring step and clamps at both ends", () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(CANVAS_ZOOM_STEPS[0], -1)).toBe(CANVAS_ZOOM_STEPS[0]);
    expect(stepZoom(CANVAS_ZOOM_STEPS[CANVAS_ZOOM_STEPS.length - 1], 1)).toBe(
      CANVAS_ZOOM_STEPS[CANVAS_ZOOM_STEPS.length - 1],
    );
  });
});

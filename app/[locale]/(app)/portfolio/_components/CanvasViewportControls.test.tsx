import { describe, it, expect, afterEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { CanvasViewportControls } from "./CanvasViewportControls";
import { setCanvasDevice, setCanvasZoom } from "@/lib/page-builder/canvasViewportStore";

afterEach(() => {
  cleanup();
  // Reset the shared module-level store between tests.
  setCanvasDevice("desktop");
  setCanvasZoom(1);
});

describe("CanvasViewportControls", () => {
  it("renders device + zoom controls and steps the zoom out", () => {
    renderWithProviders(<CanvasViewportControls />);
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mobile" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByText("75%")).toBeTruthy();
  });
});

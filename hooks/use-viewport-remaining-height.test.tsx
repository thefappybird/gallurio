import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  calculateViewportRemainingHeight,
  useViewportRemainingHeight,
} from "./use-viewport-remaining-height";

describe("calculateViewportRemainingHeight", () => {
  it("fills from the element top to the viewport bottom padding", () => {
    expect(
      calculateViewportRemainingHeight({
        viewportHeight: 912,
        elementTop: 146,
        bottomGap: 24,
      })
    ).toBe(742);
  });

  it("reserves visible content rendered after the filling element", () => {
    expect(
      calculateViewportRemainingHeight({
        viewportHeight: 900,
        elementTop: 180,
        bottomGap: 24,
        trailingHeight: 52,
      })
    ).toBe(644);
  });
});

describe("useViewportRemainingHeight", () => {
  it("measures synchronously in the layout effect without waiting for rAF", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 800,
      height: 100,
      top: 164,
      left: 0,
      right: 800,
      bottom: 264,
      x: 0,
      y: 164,
      toJSON: () => ({}),
    });
    Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });

    function Probe() {
      const { ref, remainingHeight } = useViewportRemainingHeight<HTMLDivElement>();
      return <div ref={ref} data-testid="probe" data-h={remainingHeight ?? "null"} />;
    }
    const { getByTestId } = render(<Probe />);

    expect(getByTestId("probe").dataset.h).toBe("712");
    raf.mockRestore();
  });
});

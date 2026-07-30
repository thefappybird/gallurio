import { describe, expect, it } from "vitest";
import { calculateViewportRemainingHeight } from "./use-viewport-remaining-height";

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

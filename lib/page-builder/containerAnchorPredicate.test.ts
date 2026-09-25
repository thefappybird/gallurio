import { describe, it, expect } from "vitest";
import { isContainerClass, isAnchorHost, shouldKeepAnchor } from "./containerAnchorPredicate";
import { CONTAINER_PRESET_KEYS, NAV_PRESET_KEYS } from "./blocks/sectionPresets";

describe("isContainerClass", () => {
  it("treats a container-preset key as container-class", () => {
    expect(isContainerClass(CONTAINER_PRESET_KEYS[0])).toBe(true);
  });

  it("does not treat a nav-preset key as container-class", () => {
    expect(isContainerClass(NAV_PRESET_KEYS[0])).toBe(false);
  });
});

describe("isAnchorHost", () => {
  it("is true for the base Container type", () => {
    expect(isAnchorHost("Container")).toBe(true);
  });

  it("is true for a container-preset key", () => {
    expect(isAnchorHost(CONTAINER_PRESET_KEYS[0])).toBe(true);
  });

  it("is false for Columns (child-class only, not a host)", () => {
    expect(isAnchorHost("Columns")).toBe(false);
  });
});

describe("shouldKeepAnchor with preset children", () => {
  it("keeps the anchor when every real child is a container preset key", () => {
    expect(shouldKeepAnchor([{ type: CONTAINER_PRESET_KEYS[0] }, { type: "Container" }])).toBe(true);
  });
});

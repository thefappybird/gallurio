import { describe, it, expect } from "vitest";
import { applyGalleryChromeDefaults, getGalleryChromeLabelsFrom } from "./blockContext";

// ---------------------------------------------------------------------------
// Expected English defaults (must stay byte-identical to blockContext.ts)
// ---------------------------------------------------------------------------

const DEFAULTS = {
  empty: "No photos in this collection yet.",
  noCollection: "No collection selected.",
  unavailable: "Gallery not available.",
  error: "Gallery temporarily unavailable.",
  featuredEmpty: "No featured photos selected yet.",
  carouselHint: "Swipe or use the arrows to browse",
  carouselPrev: "Previous image",
  carouselNext: "Next image",
};

// ---------------------------------------------------------------------------
// applyGalleryChromeDefaults
// ---------------------------------------------------------------------------

describe("applyGalleryChromeDefaults", () => {
  it("returns all 8 defaults when called with an empty object", () => {
    expect(applyGalleryChromeDefaults({})).toEqual(DEFAULTS);
  });

  it("returns all 8 defaults when called with no argument", () => {
    expect(applyGalleryChromeDefaults()).toEqual(DEFAULTS);
  });

  it("overrides only the supplied keys, keeping the rest as defaults", () => {
    const result = applyGalleryChromeDefaults({ empty: "Walang larawan" });
    expect(result.empty).toBe("Walang larawan");
    expect(result.noCollection).toBe(DEFAULTS.noCollection);
    expect(result.unavailable).toBe(DEFAULTS.unavailable);
    expect(result.error).toBe(DEFAULTS.error);
    expect(result.featuredEmpty).toBe(DEFAULTS.featuredEmpty);
    expect(result.carouselHint).toBe(DEFAULTS.carouselHint);
    expect(result.carouselPrev).toBe(DEFAULTS.carouselPrev);
    expect(result.carouselNext).toBe(DEFAULTS.carouselNext);
  });
});

// ---------------------------------------------------------------------------
// getGalleryChromeLabelsFrom — client-safe, no ALS
// ---------------------------------------------------------------------------

describe("getGalleryChromeLabelsFrom", () => {
  it("returns all-English defaults when puck is undefined", () => {
    expect(getGalleryChromeLabelsFrom(undefined)).toEqual(DEFAULTS);
  });

  it("returns all-English defaults when puck is null", () => {
    expect(getGalleryChromeLabelsFrom(null)).toEqual(DEFAULTS);
  });

  it("returns all-English defaults when puck has no metadata", () => {
    expect(getGalleryChromeLabelsFrom({})).toEqual(DEFAULTS);
  });

  it("returns all-English defaults when puck.metadata.workspace has no chrome", () => {
    expect(
      getGalleryChromeLabelsFrom({ metadata: { workspace: { _id: "ws-1", name: "Studio" } } })
    ).toEqual(DEFAULTS);
  });

  it("overrides empty from puck metadata while keeping other keys as defaults", () => {
    const puck = {
      metadata: {
        workspace: {
          _id: "ws-2",
          name: "Liwanag",
          chrome: { gallery: { empty: "Walang larawan" } },
        },
      },
    };
    const result = getGalleryChromeLabelsFrom(puck);
    expect(result.empty).toBe("Walang larawan");
    expect(result.noCollection).toBe(DEFAULTS.noCollection);
    expect(result.unavailable).toBe(DEFAULTS.unavailable);
    expect(result.error).toBe(DEFAULTS.error);
    expect(result.featuredEmpty).toBe(DEFAULTS.featuredEmpty);
    expect(result.carouselHint).toBe(DEFAULTS.carouselHint);
    expect(result.carouselPrev).toBe(DEFAULTS.carouselPrev);
    expect(result.carouselNext).toBe(DEFAULTS.carouselNext);
  });

  it("passes through all 8 keys when fully provided via puck metadata", () => {
    const chrome = {
      empty: "E",
      noCollection: "NC",
      unavailable: "U",
      error: "Err",
      featuredEmpty: "FE",
      carouselHint: "CH",
      carouselPrev: "CP",
      carouselNext: "CN",
    };
    const puck = { metadata: { workspace: { _id: "ws-3", name: "X", chrome: { gallery: chrome } } } };
    expect(getGalleryChromeLabelsFrom(puck)).toEqual(chrome);
  });
});

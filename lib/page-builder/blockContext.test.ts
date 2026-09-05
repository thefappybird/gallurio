import { describe, it, expect } from "vitest";
import {
  applyGalleryChromeDefaults,
  getGalleryChromeLabelsFrom,
  applyCollectionPopupDefaults,
  applyNavChromeDefaults,
  getNavChromeLabelsFrom,
  getPreviewNavFrom,
} from "./blockContext";

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
  lightboxClose: "Close",
  lightboxCounter: "{current} / {total}",
  lightboxFilmstrip: "Photo filmstrip",
  lightboxSeeMore: "See more",
  lightboxSeeLess: "See less",
  lightboxPhotoOf: "Photo {current} of {total}",
};

// ---------------------------------------------------------------------------
// applyGalleryChromeDefaults
// ---------------------------------------------------------------------------

describe("applyGalleryChromeDefaults", () => {
  it("returns all 14 defaults when called with an empty object", () => {
    expect(applyGalleryChromeDefaults({})).toEqual(DEFAULTS);
  });

  it("returns all 14 defaults when called with no argument", () => {
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
    expect(result.lightboxClose).toBe(DEFAULTS.lightboxClose);
    expect(result.lightboxCounter).toBe(DEFAULTS.lightboxCounter);
    expect(result.lightboxFilmstrip).toBe(DEFAULTS.lightboxFilmstrip);
    expect(result.lightboxSeeMore).toBe(DEFAULTS.lightboxSeeMore);
    expect(result.lightboxSeeLess).toBe(DEFAULTS.lightboxSeeLess);
    expect(result.lightboxPhotoOf).toBe(DEFAULTS.lightboxPhotoOf);
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
    expect(result.lightboxClose).toBe(DEFAULTS.lightboxClose);
    expect(result.lightboxCounter).toBe(DEFAULTS.lightboxCounter);
    expect(result.lightboxFilmstrip).toBe(DEFAULTS.lightboxFilmstrip);
    expect(result.lightboxSeeMore).toBe(DEFAULTS.lightboxSeeMore);
    expect(result.lightboxSeeLess).toBe(DEFAULTS.lightboxSeeLess);
    expect(result.lightboxPhotoOf).toBe(DEFAULTS.lightboxPhotoOf);
  });

  it("passes through all 14 keys when fully provided via puck metadata", () => {
    const chrome = {
      empty: "E",
      noCollection: "NC",
      unavailable: "U",
      error: "Err",
      featuredEmpty: "FE",
      carouselHint: "CH",
      carouselPrev: "CP",
      carouselNext: "CN",
      lightboxClose: "LC",
      lightboxCounter: "LCT",
      lightboxFilmstrip: "LF",
      lightboxSeeMore: "SM",
      lightboxSeeLess: "SL",
      lightboxPhotoOf: "LPO",
    };
    const puck = { metadata: { workspace: { _id: "ws-3", name: "X", chrome: { gallery: chrome } } } };
    expect(getGalleryChromeLabelsFrom(puck)).toEqual(chrome);
  });
});

// ---------------------------------------------------------------------------
// Nav chrome — mirrors the gallery chrome tests above.
// ---------------------------------------------------------------------------

const NAV_DEFAULTS = {
  navLandmark: "Portfolio",
  home: "Home",
  gallery: "Gallery",
  contact: "Contact",
  openMenu: "Open menu",
  closeMenu: "Close menu",
};

describe("applyNavChromeDefaults", () => {
  it("returns all 6 defaults when called with an empty object", () => {
    expect(applyNavChromeDefaults({})).toEqual(NAV_DEFAULTS);
  });

  it("returns all 6 defaults when called with no argument", () => {
    expect(applyNavChromeDefaults()).toEqual(NAV_DEFAULTS);
  });

  it("overrides only the supplied keys, keeping the rest as defaults", () => {
    const result = applyNavChromeDefaults({ home: "Simula" });
    expect(result.home).toBe("Simula");
    expect(result.navLandmark).toBe(NAV_DEFAULTS.navLandmark);
    expect(result.gallery).toBe(NAV_DEFAULTS.gallery);
    expect(result.contact).toBe(NAV_DEFAULTS.contact);
    expect(result.openMenu).toBe(NAV_DEFAULTS.openMenu);
    expect(result.closeMenu).toBe(NAV_DEFAULTS.closeMenu);
  });
});

describe("getNavChromeLabelsFrom", () => {
  it("returns all-English defaults when puck is undefined", () => {
    expect(getNavChromeLabelsFrom(undefined)).toEqual(NAV_DEFAULTS);
  });

  it("returns all-English defaults when puck is null", () => {
    expect(getNavChromeLabelsFrom(null)).toEqual(NAV_DEFAULTS);
  });

  it("returns all-English defaults when puck has no metadata", () => {
    expect(getNavChromeLabelsFrom({})).toEqual(NAV_DEFAULTS);
  });

  it("returns all-English defaults when puck.metadata.workspace has no chrome", () => {
    expect(
      getNavChromeLabelsFrom({ metadata: { workspace: { _id: "ws-1", name: "Studio" } } })
    ).toEqual(NAV_DEFAULTS);
  });

  it("overrides home from puck metadata while keeping other keys as defaults", () => {
    const puck = {
      metadata: {
        workspace: {
          _id: "ws-2",
          name: "Liwanag",
          chrome: { nav: { home: "Simula" } },
        },
      },
    };
    const result = getNavChromeLabelsFrom(puck);
    expect(result.home).toBe("Simula");
    expect(result.navLandmark).toBe(NAV_DEFAULTS.navLandmark);
    expect(result.gallery).toBe(NAV_DEFAULTS.gallery);
    expect(result.contact).toBe(NAV_DEFAULTS.contact);
    expect(result.openMenu).toBe(NAV_DEFAULTS.openMenu);
    expect(result.closeMenu).toBe(NAV_DEFAULTS.closeMenu);
  });

  it("passes through all 6 keys when fully provided via puck metadata", () => {
    const chrome = {
      navLandmark: "NL",
      home: "H",
      gallery: "G",
      contact: "C",
      openMenu: "OM",
      closeMenu: "CM",
    };
    const puck = { metadata: { workspace: { _id: "ws-3", name: "X", chrome: { nav: chrome } } } };
    expect(getNavChromeLabelsFrom(puck)).toEqual(chrome);
  });
});

// ---------------------------------------------------------------------------
// getPreviewNavFrom — preview-iframe href/active-path override
// ---------------------------------------------------------------------------

describe("getPreviewNavFrom", () => {
  it("returns null when puck is undefined", () => {
    expect(getPreviewNavFrom(undefined)).toBeNull();
  });

  it("returns null when puck is null", () => {
    expect(getPreviewNavFrom(null)).toBeNull();
  });

  it("returns null when puck has no metadata", () => {
    expect(getPreviewNavFrom({})).toBeNull();
  });

  it("returns null when puck.metadata.workspace has no previewNav (live public page / editor canvas)", () => {
    expect(
      getPreviewNavFrom({ metadata: { workspace: { _id: "ws-1", name: "Studio" } } })
    ).toBeNull();
  });

  it("passes through the preview override when present", () => {
    const puck = {
      metadata: {
        workspace: {
          _id: "ws-2",
          name: "Studio",
          previewNav: {
            homeHref: "/en/portfolio-preview?zone=home",
            galleryHref: "/en/portfolio-preview?zone=gallery",
            activePath: "/en/portfolio-preview?zone=gallery",
          },
        },
      },
    };
    expect(getPreviewNavFrom(puck)).toEqual({
      homeHref: "/en/portfolio-preview?zone=home",
      galleryHref: "/en/portfolio-preview?zone=gallery",
      activePath: "/en/portfolio-preview?zone=gallery",
    });
  });
});

it("applyCollectionPopupDefaults returns all English defaults when called empty", () => {
  expect(applyCollectionPopupDefaults({})).toEqual({
    close: "Close",
    loading: "Loading...",
    failed: "Failed to load photos.",
    retry: "Retry",
    empty: "No photos in this collection yet.",
    fullSizeAlt: "Full size photo",
    openPhoto: "Open photo",
    photo: "Photo",
    loadMore: "Load more",
    loadingMore: "Loading more...",
    loadMoreFailed: "Failed to load more photos.",
    photoCountOne: "1 photo",
    photoCountOther: "{count} photos",
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    filmstripLabel: "Photo filmstrip",
    photoOf: "Photo {current} of {total}",
  });
});

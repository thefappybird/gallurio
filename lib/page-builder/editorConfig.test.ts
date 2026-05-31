import { describe, it, expect } from "vitest";
import { editorPuckConfig } from "./editorConfig";
import { puckConfig } from "./config";
import { heroDefaultProps } from "./blocks/HeroBlock";
import { aboutDefaultProps } from "./blocks/AboutBlock";
import { galleryGridDefaultProps } from "./blocks/GalleryGridBlock";
import { galleryMasonryDefaultProps } from "./blocks/GalleryMasonryBlock";
import { galleryCarouselDefaultProps } from "./blocks/GalleryCarouselBlock";
import { featuredWorkDefaultProps } from "./blocks/FeaturedWorkBlock";
import { servicesListDefaultProps } from "./blocks/ServicesListBlock";
import { ctaBannerDefaultProps } from "./blocks/CTABannerBlock";
import { contactCardDefaultProps } from "./blocks/ContactCardBlock";

// The editor config mirrors the production blocks for client-safe previews. If a
// block's component keys or defaultProps drift from the editor's, saved data
// won't round-trip. This guards that parity.

describe("editorPuckConfig parity with production puckConfig", () => {
  it("registers exactly the same component types", () => {
    expect(Object.keys(editorPuckConfig.components).sort()).toEqual(
      Object.keys(puckConfig.components).sort()
    );
  });

  const defaults: Record<string, unknown> = {
    Hero: heroDefaultProps,
    About: aboutDefaultProps,
    GalleryGrid: galleryGridDefaultProps,
    GalleryMasonry: galleryMasonryDefaultProps,
    GalleryCarousel: galleryCarouselDefaultProps,
    FeaturedWork: featuredWorkDefaultProps,
    ServicesList: servicesListDefaultProps,
    CTABanner: ctaBannerDefaultProps,
    ContactCard: contactCardDefaultProps,
  };

  for (const [type, blockDefaults] of Object.entries(defaults)) {
    it(`${type}: editor defaultProps match the block's defaultProps`, () => {
      const editorDefaults = (
        editorPuckConfig.components as Record<string, { defaultProps?: unknown }>
      )[type]?.defaultProps;
      expect(editorDefaults).toEqual(blockDefaults);
    });

    it(`${type}: editor field keys match the production block's field keys`, () => {
      const editorFields = Object.keys(
        (editorPuckConfig.components as Record<string, { fields?: object }>)[type]?.fields ?? {}
      ).sort();
      const prodFields = Object.keys(
        (puckConfig.components as Record<string, { fields?: object }>)[type]?.fields ?? {}
      ).sort();
      expect(editorFields).toEqual(prodFields);
    });
  }
});

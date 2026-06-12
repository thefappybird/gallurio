/**
 * Fixture Puck document used by blockShapes.test.ts (integration test).
 *
 * Uses only registered block types from the new block model.
 * Sentinel strings are deliberately unique so integration tests can grep for
 * them in the rendered HTML.
 *
 * Top-level content items carry stable `id`s. Nested slot children (inside
 * preset Container slots) do NOT need ids — verified by Puck's runtime.
 */

import type { PuckData } from "../types";
import { galleryGridDefaultProps } from "../blocks/GalleryGridBlock";
import { galleryMasonryDefaultProps } from "../blocks/GalleryMasonryBlock";
import { galleryCarouselDefaultProps } from "../blocks/GalleryCarouselBlock";
import { featuredWorkDefaultProps } from "../blocks/FeaturedWorkBlock";
import { HERO_PRESET, SERVICES_PRESET } from "../blocks/sectionPresets";

export const FIXTURE_HEADING_TEXT = "FIXTURE_HEADING_TEXT";
export const FIXTURE_HERO_HEADLINE = "Capturing moments that last forever";
export const FIXTURE_SERVICES_HEADING = "Services";

export const homeDataFixture: PuckData = {
  root: { props: {} },
  content: [
    // A standalone Heading block so tests can grep for the sentinel text.
    {
      type: "Heading",
      props: {
        id: "fixture-heading-1",
        text: FIXTURE_HEADING_TEXT,
        level: "h1",
      },
    },
    // HeroPreset — a Container-based composition; covers hero + about roles.
    {
      type: "HeroPreset",
      props: {
        id: "fixture-hero-preset-1",
        ...HERO_PRESET,
      },
    },
    // ServicesPreset — a Container-based composition for services layout.
    {
      type: "ServicesPreset",
      props: {
        id: "fixture-services-preset-1",
        ...SERVICES_PRESET,
      },
    },
    // Data blocks
    {
      type: "GalleryGrid",
      props: {
        id: "fixture-gallery-1",
        ...galleryGridDefaultProps,
        collectionId: "",
      },
    },
    {
      type: "GalleryMasonry",
      props: {
        id: "fixture-masonry-1",
        ...galleryMasonryDefaultProps,
        collectionId: "",
      },
    },
    {
      type: "GalleryCarousel",
      props: {
        id: "fixture-carousel-1",
        ...galleryCarouselDefaultProps,
        collectionId: "",
      },
    },
    {
      type: "FeaturedWork",
      props: {
        id: "fixture-featured-1",
        ...featuredWorkDefaultProps,
      },
    },
  ],
  zones: {},
};

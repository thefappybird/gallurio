/**
 * Fixture Puck document containing one entry per Phase 3 block.
 * Used by blockShapes.test.ts (integration test) and by the seed script
 * to populate publicPage.data.home in the dev database.
 *
 * Sentinel strings are deliberately unique so the integration test can grep
 * for them in the rendered HTML.
 */

import type { PuckData } from "../types";
import { heroDefaultProps } from "../blocks/HeroBlock";
import { aboutDefaultProps } from "../blocks/AboutBlock";
import { galleryGridDefaultProps } from "../blocks/GalleryGridBlock";
import { servicesListDefaultProps } from "../blocks/ServicesListBlock";
import { ctaBannerDefaultProps } from "../blocks/CTABannerBlock";
import { contactCardDefaultProps } from "../blocks/ContactCardBlock";

export const homeDataFixture: PuckData = {
  root: { props: {} },
  content: [
    {
      type: "Hero",
      props: {
        id: "fixture-hero-1",
        ...heroDefaultProps,
        headline: "FIXTURE_HERO_HEADLINE",
        subhead: "FIXTURE_HERO_SUBHEAD",
        primaryCtaLabel: "FIXTURE_HERO_CTA",
        // No background image — uses accent gradient in fixture
        backgroundImagePublicId: "",
        backgroundImageUrl: "",
      },
    },
    {
      type: "About",
      props: {
        id: "fixture-about-1",
        ...aboutDefaultProps,
        heading: "FIXTURE_ABOUT_HEADING",
        body: "FIXTURE_ABOUT_BODY",
      },
    },
    {
      type: "GalleryGrid",
      props: {
        id: "fixture-gallery-1",
        ...galleryGridDefaultProps,
        collectionId: "",
        // Empty collection → renders empty state placeholder in fixture tests
      },
    },
    {
      type: "ServicesList",
      props: {
        id: "fixture-services-1",
        ...servicesListDefaultProps,
        heading: "FIXTURE_SERVICES_HEADING",
        items: [
          {
            title: "FIXTURE_SERVICE_TITLE",
            description: "FIXTURE_SERVICE_DESC",
            priceFrom: "₱10,000",
          },
        ],
      },
    },
    {
      type: "CTABanner",
      props: {
        id: "fixture-cta-1",
        ...ctaBannerDefaultProps,
        headline: "FIXTURE_CTA_HEADLINE",
        ctaLabel: "FIXTURE_CTA_LABEL",
        background: "accent",
      },
    },
    {
      type: "ContactCard",
      props: {
        id: "fixture-contact-1",
        ...contactCardDefaultProps,
        heading: "FIXTURE_CONTACT_HEADING",
        inlineCtaLabel: "FIXTURE_CONTACT_CTA",
      },
    },
  ],
  zones: {},
};

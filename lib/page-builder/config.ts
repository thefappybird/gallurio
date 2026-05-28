/**
 * Shared Puck configuration for Gallurio portfolio pages.
 *
 * Imported by:
 * - app/(public)/w/[orgSlug]/page.tsx  → <Render data={...} config={puckConfig} />
 * - app/[locale]/(app)/page-builder/  → <Puck data={...} config={puckConfig} onPublish={...} />
 */

import type { Config } from "@measured/puck";
import { heroBlockConfig } from "./blocks/HeroBlock";
import { aboutBlockConfig } from "./blocks/AboutBlock";
import { galleryGridBlockConfig } from "./blocks/GalleryGridBlock";
import { galleryMasonryBlockConfig } from "./blocks/GalleryMasonryBlock";
import { galleryCarouselBlockConfig } from "./blocks/GalleryCarouselBlock";
import { featuredWorkBlockConfig } from "./blocks/FeaturedWorkBlock";
import { servicesListBlockConfig } from "./blocks/ServicesListBlock";
import { ctaBannerBlockConfig } from "./blocks/CTABannerBlock";
import { contactCardBlockConfig } from "./blocks/ContactCardBlock";
import type { HeroBlockProps } from "./blocks/HeroBlock";
import type { AboutBlockProps } from "./blocks/AboutBlock";
import type { GalleryGridProps } from "./blocks/GalleryGridBlock";
import type { GalleryMasonryProps } from "./blocks/GalleryMasonryBlock";
import type { GalleryCarouselProps } from "./blocks/GalleryCarouselBlock";
import type { FeaturedWorkProps } from "./blocks/FeaturedWorkBlock";
import type { ServicesListProps } from "./blocks/ServicesListBlock";
import type { CTABannerProps } from "./blocks/CTABannerBlock";
import type { ContactCardProps } from "./blocks/ContactCardBlock";

// ---------------------------------------------------------------------------
// Components union
// ---------------------------------------------------------------------------

type Components = {
  Hero: HeroBlockProps;
  About: AboutBlockProps;
  GalleryGrid: GalleryGridProps;
  GalleryMasonry: GalleryMasonryProps;
  GalleryCarousel: GalleryCarouselProps;
  FeaturedWork: FeaturedWorkProps;
  ServicesList: ServicesListProps;
  CTABanner: CTABannerProps;
  ContactCard: ContactCardProps;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const puckConfig: Config<Components> = {
  components: {
    Hero: heroBlockConfig,
    About: aboutBlockConfig,
    GalleryGrid: galleryGridBlockConfig,
    GalleryMasonry: galleryMasonryBlockConfig,
    GalleryCarousel: galleryCarouselBlockConfig,
    FeaturedWork: featuredWorkBlockConfig,
    ServicesList: servicesListBlockConfig,
    CTABanner: ctaBannerBlockConfig,
    ContactCard: contactCardBlockConfig,
  },
  root: {
    fields: {},
  },
};

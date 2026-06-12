import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "./types";
import {
  heroPreset,
  aboutPreset,
  servicesPreset,
  ctaPreset,
  galleryGrid,
  zone,
} from "./_blocks";

export const eventPhotographerTemplate: PortfolioTemplate = {
  id: "event-photographer",
  label: "Event Photographer",
  businessType: "photographer",
  description: "Bold, energetic layout for corporate events, debuts, and gatherings.",
  previewImage: "/template-previews/event-photographer.svg",
  defaultBrandKit: {
    ...DEFAULT_BRAND_KIT,
    themePreset: "bold",
    fontPair: "fraunces-inter",
    accentColor: "#1f3a5f",
  },
  defaultContact: {
    title: "Book your event",
    description: "Tell me the date, venue, and vibe — I'll send availability and packages.",
    buttonStyle: "solid",
    buttonColor: "primary",
  },
  seedData: () => ({
    home: zone([
      heroPreset("ep-home-hero"),
      servicesPreset("ep-home-services"),
      aboutPreset("ep-home-about"),
      ctaPreset("ep-home-cta"),
    ]),
    gallery: zone([galleryGrid("ep-gallery-grid", { columns: 3 })]),
  }),
};

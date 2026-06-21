import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import {
  heroPreset,
  aboutPreset,
  servicesPreset,
  ctaPreset,
  galleryMasonry,
  zone,
} from "./_blocks";

export const weddingPhotographerTemplate: PortfolioTemplate = {
  id: "wedding-photographer",
  label: "Wedding Photographer",
  businessType: "photographer",
  description: "Image-first hero, featured weddings, services, and a warm contact close.",
  previewImage: "/template-previews/wedding-photographer.svg",
  defaultBrandKit: THEME_PRESET_DEFINITIONS.romantic.brandKit,
  defaultContact: {
    title: "Let's tell your story",
    description: "Share a few details about your day and I'll be in touch within 48 hours.",
    buttonStyle: "soft",
    buttonColor: "accent",
  },
  seedData: (ctx) => ({
    home: zone([
      heroPreset("wp-home-hero"),
      aboutPreset("wp-home-about"),
      servicesPreset("wp-home-services"),
      ctaPreset("wp-home-cta"),
    ]),
    gallery: zone([galleryMasonry("wp-gallery-masonry", { columns: 3 })]),
  }),
};

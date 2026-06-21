import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import {
  heroPreset,
  aboutPreset,
  servicesPreset,
  ctaPreset,
  galleryGrid,
  galleryCarousel,
  zone,
} from "./_blocks";

export const venueStylistTemplate: PortfolioTemplate = {
  id: "venue-stylist",
  label: "Venue & Stylist",
  businessType: "stylist",
  description: "Lush, editorial layout that lets spaces and styling lead.",
  previewImage: "/template-previews/venue-stylist.svg",
  defaultBrandKit: THEME_PRESET_DEFINITIONS.luxury.brandKit,
  defaultContact: {
    title: "Enquire about styling",
    description: "Share your date and palette — we'll craft a styling proposal for your space.",
    buttonStyle: "outline",
    buttonColor: "accent",
  },
  seedData: (ctx) => ({
    home: zone([
      heroPreset("vs-home-hero"),
      servicesPreset("vs-home-services"),
      aboutPreset("vs-home-about"),
      ctaPreset("vs-home-cta"),
    ]),
    gallery: zone([
      galleryGrid("vs-gallery-grid", { columns: 3 }),
      galleryCarousel("vs-gallery-carousel", { aspect: "landscape" }),
    ]),
  }),
};

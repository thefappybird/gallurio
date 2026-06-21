import { THEME_PRESET_DEFINITIONS } from "@/lib/page-builder/brandKitPicker/themePresetDefinitions";
import type { PortfolioTemplate } from "./types";
import {
  heroPreset,
  aboutPreset,
  servicesPreset,
  ctaPreset,
  galleryGrid,
  galleryMasonry,
  zone,
} from "./_blocks";

export const plannerTemplate: PortfolioTemplate = {
  id: "planner",
  label: "Event Planner",
  businessType: "planner",
  description: "Trust-building layout: services, portfolio, and a clear inquiry path.",
  previewImage: "/template-previews/planner.svg",
  defaultBrandKit: THEME_PRESET_DEFINITIONS.modern.brandKit,
  defaultContact: {
    title: "Plan with us",
    description: "Tell us your date and vision — we'll reply with a tailored proposal.",
    buttonStyle: "solid",
    buttonColor: "accent",
  },
  seedData: (ctx) => ({
    home: zone([
      heroPreset("pl-home-hero"),
      servicesPreset("pl-home-services"),
      aboutPreset("pl-home-about"),
      ctaPreset("pl-home-cta"),
    ]),
    gallery: zone([
      galleryGrid("pl-gallery-grid", { columns: 3 }),
      galleryMasonry("pl-gallery-masonry", { columns: 2 }),
    ]),
  }),
};

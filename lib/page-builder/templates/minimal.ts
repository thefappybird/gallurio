import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "./types";
import { heroPreset, aboutPreset, ctaPreset, galleryGrid, zone } from "./_blocks";

export const minimalTemplate: PortfolioTemplate = {
  id: "minimal",
  label: "Minimal",
  businessType: "other",
  description: "A clean, no-frills starting point. Add blocks as you go.",
  previewImage: "/template-previews/minimal.svg",
  defaultBrandKit: {
    ...DEFAULT_BRAND_KIT,
    themePreset: "minimal",
    fontPair: "merriweather-only",
  },
  defaultContact: {
    title: "Get in touch",
    description: "Send a message and we'll get back to you soon.",
    buttonStyle: "solid",
    buttonColor: "foreground",
  },
  seedData: () => ({
    home: zone([
      heroPreset("min-home-hero"),
      aboutPreset("min-home-about"),
      ctaPreset("min-home-cta"),
    ]),
    gallery: zone([galleryGrid("min-gallery-grid", { columns: 3, maxItems: 12 })]),
  }),
};

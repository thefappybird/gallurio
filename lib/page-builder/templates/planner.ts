import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "./types";
import {
  heroPreset,
  aboutPreset,
  servicesPreset,
  ctaPreset,
  galleryMasonry,
  zone,
} from "./_blocks";

export const plannerTemplate: PortfolioTemplate = {
  id: "planner",
  label: "Event Planner",
  businessType: "planner",
  description: "Trust-building layout: services, portfolio, and a clear inquiry path.",
  previewImage: "/template-previews/planner.svg",
  defaultBrandKit: {
    ...DEFAULT_BRAND_KIT,
    themePreset: "modern",
    fontPair: "dm-serif-dm-sans",
    accentColor: "#2f5d56",
  },
  defaultContact: {
    title: "Plan with us",
    description: "Tell us your date and vision — we'll reply with a tailored proposal.",
    buttonStyle: "solid",
    buttonColor: "accent",
  },
  seedData: () => ({
    home: zone([
      heroPreset("pl-home-hero"),
      servicesPreset("pl-home-services"),
      aboutPreset("pl-home-about"),
      ctaPreset("pl-home-cta"),
    ]),
    gallery: zone([galleryMasonry("pl-gallery-masonry", { columns: 3 })]),
  }),
};

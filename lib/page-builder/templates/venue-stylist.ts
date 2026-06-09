import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "./types";
import {
  heroPreset,
  aboutPreset,
  servicesPreset,
  ctaPreset,
  galleryCarousel,
  zone,
} from "./_blocks";

export const venueStylistTemplate: PortfolioTemplate = {
  id: "venue-stylist",
  label: "Venue & Stylist",
  businessType: "stylist",
  description: "Lush, romantic layout that lets spaces and styling lead.",
  previewImage: "/template-previews/venue-stylist.svg",
  defaultBrandKit: {
    ...DEFAULT_BRAND_KIT,
    themePreset: "romantic",
    fontPair: "cormorant-montserrat",
    accentColor: "#9c6b6b",
  },
  defaultContact: {
    title: "Enquire about styling",
    description: "Share your date and palette — we'll craft a styling proposal for your space.",
    buttonStyle: "soft",
    buttonColor: "accent",
  },
  seedData: () => ({
    home: zone([
      heroPreset("vs-home-hero"),
      aboutPreset("vs-home-about"),
      servicesPreset("vs-home-services"),
      ctaPreset("vs-home-cta"),
    ]),
    gallery: zone([galleryCarousel("vs-gallery-carousel", { aspect: "landscape" })]),
  }),
};

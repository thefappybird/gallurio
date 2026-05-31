import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "./types";
import {
  hero,
  about,
  featuredWork,
  servicesList,
  ctaBanner,
  contactCard,
  galleryMasonry,
  zone,
} from "./_blocks";

export const weddingPhotographerTemplate: PortfolioTemplate = {
  id: "wedding-photographer",
  label: "Wedding Photographer",
  businessType: "photographer",
  description: "Image-first hero, featured weddings, services, and a warm contact close.",
  previewImage: "/template-previews/wedding-photographer.svg",
  defaultBrandKit: {
    ...DEFAULT_BRAND_KIT,
    themePreset: "editorial",
    fontPair: "playfair-inter",
    accentColor: "#7e6a52",
  },
  defaultContact: {
    title: "Let's tell your story",
    description: "Share a few details about your day and I'll be in touch within 48 hours.",
    buttonStyle: "solid",
    buttonColor: "accent",
  },
  seedData: ({ workspace }) => ({
    home: zone([
      hero({
        headline: workspace.name,
        subhead: workspace.branding?.tagline || "Wedding photography that lasts a lifetime.",
        primaryCtaLabel: "Inquire",
        secondaryCtaLabel: "See galleries",
      }),
      about({
        heading: "About",
        body:
          workspace.branding?.description ||
          "I photograph weddings with a calm, documentary eye — the quiet glances, the loud joy, all of it.",
        imagePosition: "left",
      }),
      featuredWork({ heading: "Recent weddings", layout: "stagger" }),
      servicesList({
        heading: "Collections",
        items: [
          { title: "Engagement session", description: "A relaxed 60-minute shoot to warm up to the camera." },
          { title: "Wedding day coverage", description: "Up to 10 hours with a second shooter." },
          { title: "Heirloom album", description: "A hand-curated 30-spread fine-art album." },
        ],
      }),
      ctaBanner({ headline: "Let's create something beautiful.", ctaLabel: "Start your inquiry" }),
      contactCard({ heading: "Get in touch" }),
    ]),
    gallery: zone([galleryMasonry({ columns: 3, maxItems: 24 })]),
  }),
};

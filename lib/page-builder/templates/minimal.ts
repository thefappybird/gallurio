import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "./types";
import { hero, about, ctaBanner, contactCard, galleryGrid, zone } from "./_blocks";

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
  seedData: ({ workspace }) => ({
    home: zone([
      hero({
        headline: workspace.name,
        subhead: workspace.branding?.tagline || "",
        primaryCtaLabel: "Get in touch",
        secondaryCtaLabel: "View work",
        height: "medium",
      }),
      about({
        heading: "About",
        body: workspace.branding?.description || "Tell your story here.",
      }),
      ctaBanner({ headline: "Ready to work together?", ctaLabel: "Get in touch" }),
      contactCard({ heading: "Get in touch" }),
    ]),
    gallery: zone([galleryGrid({ columns: 3, maxItems: 12 })]),
  }),
};

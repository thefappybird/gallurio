import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "./types";
import {
  hero,
  about,
  featuredWork,
  servicesList,
  ctaBanner,
  contactCard,
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
  seedData: ({ workspace }) => ({
    home: zone([
      hero({
        headline: workspace.name,
        subhead: workspace.branding?.tagline || "Spaces styled to take your breath away.",
        primaryCtaLabel: "Enquire",
        secondaryCtaLabel: "View spaces",
        alignment: "center",
        height: "tall",
      }),
      featuredWork({ heading: "Signature spaces", layout: "row" }),
      about({
        heading: "The studio",
        body:
          workspace.branding?.description ||
          "We style venues with texture, light, and restraint — settings that feel effortless and unforgettable.",
        imagePosition: "right",
      }),
      servicesList({
        heading: "Styling services",
        items: [
          { title: "Full styling", description: "Concept, sourcing, and on-site styling." },
          { title: "Floral & tablescapes", description: "Seasonal arrangements and table design." },
          { title: "Venue dressing", description: "Transform your chosen space end to end." },
        ],
      }),
      ctaBanner({ headline: "Let's style your space.", ctaLabel: "Start an enquiry", background: "surface" }),
      contactCard({ heading: "Get in touch", showAddress: true }),
    ]),
    gallery: zone([galleryCarousel({ aspect: "landscape", maxItems: 16 })]),
  }),
};

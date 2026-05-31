import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "./types";
import {
  hero,
  about,
  servicesList,
  featuredWork,
  ctaBanner,
  contactCard,
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
  seedData: ({ workspace }) => ({
    home: zone([
      hero({
        headline: workspace.name,
        subhead: workspace.branding?.tagline || "Event photography with energy and polish.",
        primaryCtaLabel: "Check availability",
        secondaryCtaLabel: "Browse work",
        height: "medium",
      }),
      featuredWork({ heading: "Recent events", subheading: "A few highlights from the last season." }),
      servicesList({
        heading: "What I cover",
        items: [
          { title: "Corporate events", description: "Conferences, launches, and award nights." },
          { title: "Debuts & milestones", description: "Coverage that keeps up with the celebration." },
          { title: "Same-day edits", description: "Highlight reels ready before the night ends." },
        ],
      }),
      about({
        heading: "About",
        body:
          workspace.branding?.description ||
          "Fast, unobtrusive, and reliable — I capture the room without slowing it down.",
      }),
      ctaBanner({ headline: "Got an event coming up?", ctaLabel: "Get a quote", background: "accent" }),
      contactCard({ heading: "Get in touch" }),
    ]),
    gallery: zone([galleryGrid({ columns: 3, maxItems: 18 })]),
  }),
};

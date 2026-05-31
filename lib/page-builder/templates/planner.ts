import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "./types";
import {
  hero,
  about,
  servicesList,
  featuredWork,
  ctaBanner,
  contactCard,
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
  seedData: ({ workspace }) => ({
    home: zone([
      hero({
        headline: workspace.name,
        subhead: workspace.branding?.tagline || "Thoughtfully planned events, beautifully run.",
        primaryCtaLabel: "Plan your event",
        secondaryCtaLabel: "Our work",
        alignment: "left",
        height: "medium",
      }),
      servicesList({
        heading: "How we help",
        items: [
          { title: "Full planning", description: "End-to-end coordination from concept to send-off." },
          { title: "Partial planning", description: "We step in to refine and run the day." },
          { title: "Day-of coordination", description: "You plan, we execute flawlessly." },
        ],
      }),
      featuredWork({ heading: "Selected events", layout: "stagger" }),
      about({
        heading: "Our approach",
        body:
          workspace.branding?.description ||
          "We sweat the logistics so you can be present. Calm, organized, detail-obsessed.",
        imagePosition: "left",
      }),
      ctaBanner({ headline: "Let's plan something memorable.", ctaLabel: "Start planning" }),
      contactCard({ heading: "Get in touch" }),
    ]),
    gallery: zone([galleryMasonry({ columns: 3, maxItems: 24 })]),
  }),
};

import { DEFAULT_BRAND_KIT, DEFAULT_HEADER_CONFIG } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "./types";
import { zone } from "./_blocks";

// An intentionally empty canvas. Brand kit, nav, collections popup, and contact
// form all fall back to their defaults (DEFAULT_BRAND_KIT here; header/popup keep
// the editor defaults applied when this template is chosen).
export const scratchTemplate: PortfolioTemplate = {
  id: "scratch",
  label: "I'll start from scratch",
  businessType: "other",
  description: "An empty canvas. Add blocks yourself, your way.",
  previewImage: "/template-previews/scratch.svg",
  defaultBrandKit: { ...DEFAULT_BRAND_KIT },
  defaultContact: {
    title: "Get in touch",
    description: "Send a message and we'll get back to you soon.",
    buttonStyle: "solid",
    buttonColor: "foreground",
  },
  defaultHeader: { ...DEFAULT_HEADER_CONFIG },
  defaultCollectionsPopup: {},
  seedData: () => ({
    home: zone([]),
    gallery: zone([]),
  }),
};

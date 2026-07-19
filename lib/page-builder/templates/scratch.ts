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
    // No literal title/description here — the contact modal falls back to the
    // locale-translated default (publicPage.inquiryForm.title/description) when
    // unset. Baking English text in would override that for every locale.
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

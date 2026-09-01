import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import type { PortfolioTemplate } from "./types";
import { zone, navigationBlock } from "./_blocks";

// An intentionally empty canvas but for the pinned Navigation — brand kit,
// collections popup, and contact form all fall back to their defaults
// (DEFAULT_BRAND_KIT here; popup keeps the editor defaults applied when this
// template is chosen). scratch must not open header-less.
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
  defaultCollectionsPopup: {},
  seedData: () => ({
    home: zone([navigationBlock("Navigation-scratch-home-0")]),
    gallery: zone([navigationBlock("Navigation-scratch-gal-0")]),
  }),
};

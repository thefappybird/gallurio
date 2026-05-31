import type {
  PortfolioBrandKit,
  PortfolioContactConfig,
  PortfolioPuckData,
} from "@/lib/page-builder/types";

// Canonical template ids. This is the single source of truth — the Workspace
// model imports it for `publicPage.templateId`'s enum, so adding a template here
// makes it persistable everywhere. Pure data (no React/block imports) so it is
// safe to import from server models and validators without cycles.
export const PORTFOLIO_TEMPLATE_IDS = [
  "wedding-photographer",
  "event-photographer",
  "planner",
  "venue-stylist",
  "minimal",
] as const;

export type PortfolioTemplateId = (typeof PORTFOLIO_TEMPLATE_IDS)[number];

// Workspace businessType values a template can be matched against.
export type TemplateBusinessType =
  | "photographer"
  | "venue"
  | "planner"
  | "stylist"
  | "catering"
  | "entertainer"
  | "other";

// The minimal slice of the workspace a template needs to personalize its seed
// copy. Kept narrow so templates don't depend on the full Mongoose document.
export type TemplateSeedContext = {
  workspace: {
    name: string;
    branding?: {
      tagline?: string | null;
      description?: string | null;
    } | null;
  };
};

export type PortfolioTemplate = {
  id: PortfolioTemplateId;
  /** Display label shown on the template picker card. */
  label: string;
  /** The businessType this template is the default match for. */
  businessType: TemplateBusinessType;
  /** One-line description for the picker card. */
  description: string;
  /** Public path to a preview thumbnail under /public. */
  previewImage: string;
  defaultBrandKit: PortfolioBrandKit;
  /** Seeded contact-modal copy/presentation (form fields stay fixed). */
  defaultContact: PortfolioContactConfig;
  /**
   * Produces valid Puck data for both zones. Gallery blocks are seeded with an
   * empty `collectionId` — the wizard save action injects the real
   * "featured-work" collection id after creating it.
   */
  seedData: (ctx: TemplateSeedContext) => PortfolioPuckData;
};

import type { PortfolioTemplate, PortfolioTemplateId, TemplateBusinessType } from "./types";
import { luxuryTemplate } from "./luxury";
import { editorialTemplate } from "./editorial";
import { minimalTemplate } from "./minimal";
import { romanticTemplate } from "./romantic";
import { modernTemplate } from "./modern";
import { scratchTemplate } from "./scratch";
import { normalizeTemplatePresetLayouts } from "./normalizePresetLayouts";

export { PORTFOLIO_TEMPLATE_IDS } from "./types";
export type {
  PortfolioTemplate,
  PortfolioTemplateId,
  TemplateBusinessType,
  TemplateSeedContext,
} from "./types";

// Order matters — this is the display order on the wizard's template grid.
const RAW_PORTFOLIO_TEMPLATES: PortfolioTemplate[] = [
  minimalTemplate,
  editorialTemplate,
  luxuryTemplate,
  romanticTemplate,
  modernTemplate,
  scratchTemplate,
];

// The verbose reference templates deliberately preserve their curated copy in
// source. A few were authored before the current preset width hierarchy, so
// normalize those known stale shapes at the shared seed boundary used by both
// server application and the client-only demo.
export const PORTFOLIO_TEMPLATES: PortfolioTemplate[] = RAW_PORTFOLIO_TEMPLATES.map((template) => ({
  ...template,
  seedData: (ctx) => normalizeTemplatePresetLayouts(template.seedData(ctx)),
}));

const BY_ID = new Map<PortfolioTemplateId, PortfolioTemplate>(
  PORTFOLIO_TEMPLATES.map((t) => [t.id, t])
);

export function getTemplate(id: string): PortfolioTemplate | null {
  return BY_ID.get(id as PortfolioTemplateId) ?? null;
}

// First-visit default template. Owners can still choose any starter template,
// but a workspace that has not explicitly selected one starts from scratch.
const BUSINESS_TYPE_DEFAULT: Record<TemplateBusinessType, PortfolioTemplateId> = {
  photographer: "scratch",
  venue: "scratch",
  stylist: "scratch",
  planner: "scratch",
  catering: "scratch",
  entertainer: "scratch",
  other: "scratch",
};

export function getTemplateForBusinessType(businessType: string | null | undefined): PortfolioTemplate {
  const id = BUSINESS_TYPE_DEFAULT[(businessType as TemplateBusinessType) ?? "other"] ?? "scratch";
  return BY_ID.get(id) ?? scratchTemplate;
}

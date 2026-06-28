import type { PortfolioTemplate, PortfolioTemplateId, TemplateBusinessType } from "./types";
import { boldTemplate } from "./bold";
import { luxuryTemplate } from "./luxury";
import { editorialTemplate } from "./editorial";
import { minimalTemplate } from "./minimal";
import { scratchTemplate } from "./scratch";

export { PORTFOLIO_TEMPLATE_IDS } from "./types";
export type {
  PortfolioTemplate,
  PortfolioTemplateId,
  TemplateBusinessType,
  TemplateSeedContext,
} from "./types";

// Order matters — this is the display order on the wizard's template grid.
export const PORTFOLIO_TEMPLATES: PortfolioTemplate[] = [
  boldTemplate,
  luxuryTemplate,
  editorialTemplate,
  minimalTemplate,
  scratchTemplate,
];

const BY_ID = new Map<PortfolioTemplateId, PortfolioTemplate>(
  PORTFOLIO_TEMPLATES.map((t) => [t.id, t])
);

export function getTemplate(id: string): PortfolioTemplate | null {
  return BY_ID.get(id as PortfolioTemplateId) ?? null;
}

// Closest template for a workspace's businessType — drives the wizard's default
// selection. Falls back to "minimal" for unmapped types.
const BUSINESS_TYPE_DEFAULT: Record<TemplateBusinessType, PortfolioTemplateId> = {
  photographer: "editorial",
  venue: "luxury",
  stylist: "luxury",
  planner: "editorial",
  catering: "editorial",
  entertainer: "bold",
  other: "minimal",
};

export function getTemplateForBusinessType(businessType: string | null | undefined): PortfolioTemplate {
  const id = BUSINESS_TYPE_DEFAULT[(businessType as TemplateBusinessType) ?? "other"] ?? "minimal";
  return BY_ID.get(id) ?? minimalTemplate;
}

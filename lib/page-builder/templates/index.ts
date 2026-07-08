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

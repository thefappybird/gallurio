import type { PlanTier } from "@/lib/db/models";
import {
  type PlanEntitlements,
  PLAN_ENTITLEMENTS,
} from "@/lib/plans/entitlements";

export type PlanCatalogEntry = {
  id: PlanTier;
  nameKey: string;
  amount: number;
  yearlyAmount?: number;
  currency: "PHP";
  descriptionKey: string;
  taglineKey: string;
  featureKeys: string[];
  highlight?: boolean;
  entitlements: PlanEntitlements;
  priceId?: string;
  yearlyPriceId?: string;
};

export function getProMonthlyPriceId() {
  return process.env.PADDLE_PRICE_PRO_MONTHLY_ID ?? process.env.PADDLE_PRICE_PRO_ID ?? "";
}

// Pricing is in PHP (display only — Paddle billing uses priceId, not amount).
// Strings here are i18n keys so the catalog stays language-neutral.
export const PLAN_CATALOG: ReadonlyArray<PlanCatalogEntry> = [
  {
    id: "free",
    nameKey: "plans.free.name",
    amount: 0,
    currency: "PHP",
    descriptionKey: "plans.free.description",
    taglineKey: "plans.free.tagline",
    featureKeys: [
      "plans.free.features.trial",
      "plans.pro.features.unlimitedBookings",
      "plans.pro.features.publicPageControls",
      "plans.pro.features.invoicePdfs",
    ],
    entitlements: PLAN_ENTITLEMENTS.free,
  },
  {
    id: "pro",
    nameKey: "plans.pro.name",
    amount: 250,
    yearlyAmount: 2500,
    currency: "PHP",
    descriptionKey: "plans.pro.description",
    taglineKey: "plans.pro.tagline",
    featureKeys: [
      "plans.pro.features.unlimitedBookings",
      "plans.pro.features.publicPageControls",
      "plans.pro.features.invoicePdfs",
      "plans.pro.features.clientManagement",
      "plans.pro.features.teamManagement",
    ],
    highlight: true,
    entitlements: PLAN_ENTITLEMENTS.pro,
    priceId: getProMonthlyPriceId(),
    yearlyPriceId: process.env.PADDLE_PRICE_PRO_YEARLY_ID ?? "",
  },
];

const PAID_PLANS = ["pro"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export function isPaidPlan(plan: PlanTier): plan is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(plan);
}

export function getPlanCatalog(id: PlanTier): PlanCatalogEntry {
  const entry = PLAN_CATALOG.find((p) => p.id === id);
  if (!entry) {
    throw new Error(`Unknown plan tier: ${id}`);
  }
  return entry;
}

// Maps a Paddle priceId back to our internal tier. Empty-string priceIds
// (unset env vars) never match so they can't accidentally upgrade a workspace.
export function planForPriceId(priceId: string): PlanTier {
  if (!priceId) return "free";
  const match = PLAN_CATALOG.find(
    (p) =>
      (p.priceId && p.priceId !== "" && p.priceId === priceId) ||
      (p.yearlyPriceId && p.yearlyPriceId !== "" && p.yearlyPriceId === priceId)
  );
  return match?.id ?? "free";
}

import type { PlanTier } from "@/lib/db/models";
import {
  type PlanEntitlements,
  PLAN_ENTITLEMENTS,
} from "@/lib/plans/entitlements";

export type PlanCatalogEntry = {
  id: PlanTier;
  nameKey: string;
  amount: number;
  currency: "PHP";
  descriptionKey: string;
  taglineKey: string;
  featureKeys: string[];
  highlight?: boolean;
  entitlements: PlanEntitlements;
};

// Pricing is in PHP. HitPay's recurring API accepts the major-unit amount as a
// number — no minor-unit conversion needed. Strings here are i18n keys so the
// catalog stays language-neutral; the plan-step form resolves them via t().
export const PLAN_CATALOG: ReadonlyArray<PlanCatalogEntry> = [
  {
    id: "free",
    nameKey: "plans.free.name",
    amount: 0,
    currency: "PHP",
    descriptionKey: "plans.free.description",
    taglineKey: "plans.free.tagline",
    featureKeys: [
      "plans.free.features.workspace",
      "plans.free.features.bookings",
      "plans.free.features.storage",
      "plans.free.features.publicPage",
    ],
    entitlements: PLAN_ENTITLEMENTS.free,
  },
  {
    id: "starter",
    nameKey: "plans.starter.name",
    amount: 499,
    currency: "PHP",
    descriptionKey: "plans.starter.description",
    taglineKey: "plans.starter.tagline",
    featureKeys: [
      "plans.starter.features.unlimitedBookings",
      "plans.starter.features.storage",
      "plans.starter.features.brandedForm",
      "plans.starter.features.acceptPayments",
    ],
    entitlements: PLAN_ENTITLEMENTS.starter,
  },
  {
    id: "pro",
    nameKey: "plans.pro.name",
    amount: 1199,
    currency: "PHP",
    descriptionKey: "plans.pro.description",
    taglineKey: "plans.pro.tagline",
    featureKeys: [
      "plans.pro.features.everythingStarter",
      "plans.pro.features.customDomain",
      "plans.pro.features.storage",
      "plans.pro.features.invoicePdfs",
      "plans.pro.features.removeBranding",
    ],
    highlight: true,
    entitlements: PLAN_ENTITLEMENTS.pro,
  },
];

const PAID_PLANS = ["starter", "pro"] as const;
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

// Used by the webhook handler to map a HitPay recurring-billing amount back
// to our internal tier. Default to "free" so stale data can't accidentally
// upgrade a workspace.
export function planForAmount(amount: number): PlanTier {
  const match = PLAN_CATALOG.find((p) => p.amount === amount && p.id !== "free");
  return match?.id ?? "free";
}

import type { PlanTier } from "@/lib/db/models";
import type { PricingTier } from "@/lib/pricing/pricingTier";
import {
  type PlanEntitlements,
  PLAN_ENTITLEMENTS,
} from "@/lib/plans/entitlements";

export type PlanCatalogEntry = {
  id: PlanTier;
  nameKey: string;
  amount: number;
  yearlyAmount?: number;
  currency: "USD";
  descriptionKey: string;
  taglineKey: string;
  featureKeys: string[];
  highlight?: boolean;
  entitlements: PlanEntitlements;
  variantId?: string;
  yearlyVariantId?: string;
};

export function getProMonthlyVariantId() {
  return process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID ?? "";
}

export function getProYearlyVariantId() {
  return process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID ?? "";
}

export function getGlobalMonthlyVariantId() {
  return process.env.LEMONSQUEEZY_VARIANT_GLOBAL_MONTHLY_ID ?? "";
}

export function getGlobalYearlyVariantId() {
  return process.env.LEMONSQUEEZY_VARIANT_GLOBAL_YEARLY_ID ?? "";
}

// Pricing is in USD (display only — Lemon Squeezy billing uses variantId, not
// amount). Strings here are i18n keys so the catalog stays language-neutral.
// PLAN_CATALOG's "pro" entry always carries the *base* tier pair — the free
// plan entry and every existing catalog consumer (entitlements lookups,
// planForVariantId, settings/onboarding UI) only ever need one Pro row. The
// global tier's variant ids + fallback amounts are resolved separately, via
// getProVariantsForTier below.
export const PLAN_CATALOG: ReadonlyArray<PlanCatalogEntry> = [
  {
    id: "free",
    nameKey: "plans.free.name",
    amount: 0,
    currency: "USD",
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
    amount: 5,
    yearlyAmount: 50,
    currency: "USD",
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
    variantId: getProMonthlyVariantId(),
    yearlyVariantId: getProYearlyVariantId(),
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

export type ProTierVariants = {
  monthlyVariantId: string;
  yearlyVariantId: string;
  monthlyAmount: number;
  yearlyAmount: number;
};

// $15/mo, $150/yr — the "global" tier fallback, offline/Docker-build only
// (see getProVariantsForTier). The "base" tier's fallback is PLAN_CATALOG's
// pro entry itself ($5/$50).
const GLOBAL_FALLBACK_AMOUNTS = { monthly: 15, yearly: 150 };

// Resolves the Lemon Squeezy variant ids + offline fallback amounts for a
// pricing tier. The only place the global pair is read — everything else
// (settings, onboarding, entitlements) keeps using PLAN_CATALOG's base pro
// entry directly.
export function getProVariantsForTier(tier: PricingTier): ProTierVariants {
  if (tier === "global") {
    return {
      monthlyVariantId: getGlobalMonthlyVariantId(),
      yearlyVariantId: getGlobalYearlyVariantId(),
      monthlyAmount: GLOBAL_FALLBACK_AMOUNTS.monthly,
      yearlyAmount: GLOBAL_FALLBACK_AMOUNTS.yearly,
    };
  }
  const pro = getPlanCatalog("pro");
  return {
    monthlyVariantId: pro.variantId ?? "",
    yearlyVariantId: pro.yearlyVariantId ?? "",
    monthlyAmount: pro.amount,
    yearlyAmount: pro.yearlyAmount ?? pro.amount,
  };
}

// Maps a Lemon Squeezy variantId back to our internal tier. Checks both the
// base and global variant pairs — a global-tier subscriber's variantId never
// appears in PLAN_CATALOG itself, which only carries the base pair (see
// above), so missing the global pair here would silently downgrade a
// global-tier subscriber's webhook to free. Empty-string variantIds (unset
// env vars) never match so they can't accidentally upgrade a workspace.
export function planForVariantId(variantId: string): PlanTier {
  if (!variantId) return "free";
  const proVariantIds = [
    getProMonthlyVariantId(),
    getProYearlyVariantId(),
    getGlobalMonthlyVariantId(),
    getGlobalYearlyVariantId(),
  ];
  return proVariantIds.includes(variantId) ? "pro" : "free";
}

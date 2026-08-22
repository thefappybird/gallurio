import { describe, it, expect, beforeAll } from "vitest";

// Env vars must be set before the module is imported so the PLAN_CATALOG
// array captures the values at module-evaluation time.
const PRO_VARIANT_ID = "1001";
const PRO_YEARLY_VARIANT_ID = "1002";
const GLOBAL_VARIANT_ID = "2001";
const GLOBAL_YEARLY_VARIANT_ID = "2002";

let planForVariantId: (id: string) => import("@/lib/db/models").PlanTier;
let PLAN_CATALOG: ReadonlyArray<import("@/lib/lemonsqueezy/plans").PlanCatalogEntry>;
let isPaidPlan: (plan: import("@/lib/db/models").PlanTier) => boolean;
let getPlanCatalog: (
  id: import("@/lib/db/models").PlanTier
) => import("@/lib/lemonsqueezy/plans").PlanCatalogEntry;
let getProVariantsForTier: (
  tier: import("@/lib/pricing/pricingTier").PricingTier
) => import("@/lib/lemonsqueezy/plans").ProTierVariants;

beforeAll(async () => {
  process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID = PRO_VARIANT_ID;
  process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID = PRO_YEARLY_VARIANT_ID;
  process.env.LEMONSQUEEZY_VARIANT_GLOBAL_MONTHLY_ID = GLOBAL_VARIANT_ID;
  process.env.LEMONSQUEEZY_VARIANT_GLOBAL_YEARLY_ID = GLOBAL_YEARLY_VARIANT_ID;

  const mod = await import("@/lib/lemonsqueezy/plans");
  planForVariantId = mod.planForVariantId;
  PLAN_CATALOG = mod.PLAN_CATALOG;
  isPaidPlan = mod.isPaidPlan;
  getPlanCatalog = mod.getPlanCatalog;
  getProVariantsForTier = mod.getProVariantsForTier;
});

describe("planForVariantId", () => {
  it("returns 'pro' for the base monthly variant id", () => {
    expect(planForVariantId(PRO_VARIANT_ID)).toBe("pro");
  });

  it("returns 'pro' for the base yearly variant id", () => {
    expect(planForVariantId(PRO_YEARLY_VARIANT_ID)).toBe("pro");
  });

  it("returns 'pro' for the global monthly variant id", () => {
    expect(planForVariantId(GLOBAL_VARIANT_ID)).toBe("pro");
  });

  it("returns 'pro' for the global yearly variant id", () => {
    expect(planForVariantId(GLOBAL_YEARLY_VARIANT_ID)).toBe("pro");
  });

  it("returns 'free' for an unknown variant id", () => {
    expect(planForVariantId("9999")).toBe("free");
  });

  it("returns 'free' for an empty string", () => {
    expect(planForVariantId("")).toBe("free");
  });
});

describe("getProVariantsForTier", () => {
  it("resolves the base pair and fallback amounts for 'base'", () => {
    const result = getProVariantsForTier("base");
    expect(result).toEqual({
      monthlyVariantId: PRO_VARIANT_ID,
      yearlyVariantId: PRO_YEARLY_VARIANT_ID,
      monthlyAmount: 5,
      yearlyAmount: 50,
    });
  });

  it("resolves the global pair and fallback amounts for 'global'", () => {
    const result = getProVariantsForTier("global");
    expect(result).toEqual({
      monthlyVariantId: GLOBAL_VARIANT_ID,
      yearlyVariantId: GLOBAL_YEARLY_VARIANT_ID,
      monthlyAmount: 15,
      yearlyAmount: 150,
    });
  });
});

describe("PLAN_CATALOG shape", () => {
  it("has exactly two entries: free, pro", () => {
    const ids = PLAN_CATALOG.map((p) => p.id);
    expect(ids).toEqual(["free", "pro"]);
  });

  it("free plan has amount 0 and no variantId", () => {
    const free = PLAN_CATALOG.find((p) => p.id === "free")!;
    expect(free.amount).toBe(0);
    expect(free.variantId).toBeUndefined();
  });

  it("pro plan carries the base tier's monthly amount 5, yearly amount 50, and variant ids", () => {
    const pro = PLAN_CATALOG.find((p) => p.id === "pro")!;
    expect(pro.amount).toBe(5);
    expect(pro.yearlyAmount).toBe(50);
    expect(pro.variantId).toBe(PRO_VARIANT_ID);
    expect(pro.yearlyVariantId).toBe(PRO_YEARLY_VARIANT_ID);
  });

  it("pro plan is highlighted", () => {
    const pro = PLAN_CATALOG.find((p) => p.id === "pro")!;
    expect(pro.highlight).toBe(true);
  });

  it("all plans use USD currency", () => {
    for (const p of PLAN_CATALOG) {
      expect(p.currency).toBe("USD");
    }
  });

  it("all plans carry entitlements", () => {
    for (const p of PLAN_CATALOG) {
      expect(p.entitlements).toBeDefined();
      expect(typeof p.entitlements.maxTeams).toBe("number");
    }
  });
});

describe("isPaidPlan", () => {
  it("returns true for pro", () => {
    expect(isPaidPlan("pro")).toBe(true);
  });

  it("returns false for free", () => {
    expect(isPaidPlan("free")).toBe(false);
  });
});

describe("getPlanCatalog", () => {
  it("returns the matching entry for each tier", () => {
    for (const p of PLAN_CATALOG) {
      const entry = getPlanCatalog(p.id);
      expect(entry.id).toBe(p.id);
    }
  });

  it("throws for an unknown tier", () => {
    // @ts-expect-error — intentionally passing invalid tier
    expect(() => getPlanCatalog("enterprise")).toThrow("Unknown plan tier");
  });
});

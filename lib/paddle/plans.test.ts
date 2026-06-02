import { describe, it, expect, beforeAll } from "vitest";

// Env vars must be set before the module is imported so the PLAN_CATALOG
// array captures the values at module-evaluation time.
const STARTER_PRICE_ID = "pri_test_starter_01";
const PRO_PRICE_ID = "pri_test_pro_01";

let planForPriceId: (id: string) => import("@/lib/db/models").PlanTier;
let PLAN_CATALOG: ReadonlyArray<import("@/lib/paddle/plans").PlanCatalogEntry>;
let isPaidPlan: (plan: import("@/lib/db/models").PlanTier) => boolean;
let getPlanCatalog: (
  id: import("@/lib/db/models").PlanTier
) => import("@/lib/paddle/plans").PlanCatalogEntry;

beforeAll(async () => {
  process.env.PADDLE_PRICE_STARTER_ID = STARTER_PRICE_ID;
  process.env.PADDLE_PRICE_PRO_ID = PRO_PRICE_ID;

  const mod = await import("@/lib/paddle/plans");
  planForPriceId = mod.planForPriceId;
  PLAN_CATALOG = mod.PLAN_CATALOG;
  isPaidPlan = mod.isPaidPlan;
  getPlanCatalog = mod.getPlanCatalog;
});

describe("planForPriceId", () => {
  it("returns 'starter' for the starter price id", () => {
    expect(planForPriceId(STARTER_PRICE_ID)).toBe("starter");
  });

  it("returns 'pro' for the pro price id", () => {
    expect(planForPriceId(PRO_PRICE_ID)).toBe("pro");
  });

  it("returns 'free' for an unknown price id", () => {
    expect(planForPriceId("pri_unknown_99")).toBe("free");
  });

  it("returns 'free' for an empty string", () => {
    expect(planForPriceId("")).toBe("free");
  });
});

describe("PLAN_CATALOG shape", () => {
  it("has exactly three entries: free, starter, pro", () => {
    const ids = PLAN_CATALOG.map((p) => p.id);
    expect(ids).toEqual(["free", "starter", "pro"]);
  });

  it("free plan has amount 0 and no priceId", () => {
    const free = PLAN_CATALOG.find((p) => p.id === "free")!;
    expect(free.amount).toBe(0);
    expect(free.priceId).toBeUndefined();
  });

  it("starter plan has amount 250 and correct priceId", () => {
    const starter = PLAN_CATALOG.find((p) => p.id === "starter")!;
    expect(starter.amount).toBe(250);
    expect(starter.priceId).toBe(STARTER_PRICE_ID);
  });

  it("pro plan has amount 500 and correct priceId", () => {
    const pro = PLAN_CATALOG.find((p) => p.id === "pro")!;
    expect(pro.amount).toBe(500);
    expect(pro.priceId).toBe(PRO_PRICE_ID);
  });

  it("pro plan is highlighted", () => {
    const pro = PLAN_CATALOG.find((p) => p.id === "pro")!;
    expect(pro.highlight).toBe(true);
  });

  it("all plans use PHP currency", () => {
    for (const p of PLAN_CATALOG) {
      expect(p.currency).toBe("PHP");
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
  it("returns true for starter", () => {
    expect(isPaidPlan("starter")).toBe(true);
  });

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

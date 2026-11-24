import { describe, expect, it } from "vitest";
import { BUSINESS_TYPE_VALUES } from "@/lib/validators/workspace";
import { PORTFOLIO_FONT_KEYS } from "@/lib/page-builder/fonts";
import {
  buildExpiredSubscriptionState,
  buildPortfolioPageviewFixtures,
  readExpiredSeedOwner,
  readSeedOwner,
  PROMO_CODE_SEEDS,
  DISCOVER_SAMPLE_SEEDS,
} from "./seed-fixtures";

describe("seed-fixtures", () => {
  it("reads the required seed identities from env", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      SEED_OWNER_WORKOS_USER_ID: "user_owner",
      SEED_OWNER_EMAIL: "owner@example.com",
      SEED_OWNER_NAME: "Owner Demo",
      SUB_EXPIRED_WORKOS_USER_ID: "user_expired",
      SUB_EXPIRED_WORKOS_EMAIL: "expired@example.com",
      SUB_EXPIRED_WORKOS_NAME: "Expired Demo",
    };

    expect(readSeedOwner(env)).toEqual({
      workosUserId: "user_owner",
      email: "owner@example.com",
      name: "Owner Demo",
    });
    expect(readExpiredSeedOwner(env)).toEqual({
      workosUserId: "user_expired",
      email: "expired@example.com",
      name: "Expired Demo",
    });
  });

  it("builds a gated expired-subscription workspace state", () => {
    const now = new Date("2026-07-11T00:00:00.000Z");
    const state = buildExpiredSubscriptionState(now);

    expect(state.plan).toBe("free");
    expect(state.everSubscribed).toBe(true);
    expect(state.lsSubscriptionStatus).toBe("canceled");
    expect(state.lsSubscriptionId).toBeNull();
    expect(state.lsCurrentPeriodEnd.toISOString()).toBe("2026-06-27T00:00:00.000Z");
  });

  it("builds consistent portfolio pageview fixtures", () => {
    const fixtures = buildPortfolioPageviewFixtures(new Date("2026-07-11T12:00:00.000Z"), 3);

    expect(fixtures).toHaveLength(12);

    const siteRows = fixtures.filter((row) => row.page === "_site");
    expect(siteRows).toHaveLength(3);
    expect(siteRows[0].views).toBeGreaterThan(siteRows[0].visitors);
    expect(siteRows[0].sources).toBeTruthy();

    const pagesForDay = fixtures.filter(
      (row) => row.date.toISOString() === siteRows[0].date.toISOString()
    );
    expect(pagesForDay.map((row) => row.page).sort()).toEqual([
      "_site",
      "contact",
      "gallery",
      "home",
    ]);
  });

  it("has the three general Pro promo codes", () => {
    const types = PROMO_CODE_SEEDS
      .filter((c) => c.type !== "beta2mo" && c.type !== "demo1mo")
      .map((c) => c.type)
      .sort();
    expect(types).toEqual(["lifetime", "monthly", "yearly"]);
  });

  it("has the demo1mo promo code", () => {
    const demo = PROMO_CODE_SEEDS.find((c) => c.type === "demo1mo");
    expect(demo).toEqual({
      title: "Portfolio Maker demo: 1 month Pro",
      code: "DEMOPRO2026",
      type: "demo1mo",
      expiresAt: null,
    });
  });

  it("has 10 Discover sample workspaces with unique slugs", () => {
    expect(DISCOVER_SAMPLE_SEEDS).toHaveLength(10);
    expect(new Set(DISCOVER_SAMPLE_SEEDS.map((s) => s.slug)).size).toBe(10);
  });

  it("gives every Discover sample a name and a valid businessType", () => {
    for (const s of DISCOVER_SAMPLE_SEEDS) {
      expect(s.name.trim()).not.toBe("");
      expect(BUSINESS_TYPE_VALUES).toContain(s.businessType);
    }
  });

  it("keeps Discover sample slugs clear of the main and expired seed workspaces", () => {
    // seed.ts runs main() on import, so its slugs cannot be imported here.
    const existing = ["seed-owner-demo", "expired-sub-demo"];
    for (const s of DISCOVER_SAMPLE_SEEDS) expect(existing).not.toContain(s.slug);
  });

  it("covers all three Discover tile kinds, with dimensions on every cover sample", () => {
    const kinds = new Set(DISCOVER_SAMPLE_SEEDS.map((s) => s.image));
    expect([...kinds].sort()).toEqual(["cover", "none", "og"]);
    for (const s of DISCOVER_SAMPLE_SEEDS.filter((x) => x.image === "cover")) {
      expect(s.coverWidth).toBeGreaterThan(0);
      expect(s.coverHeight).toBeGreaterThan(0);
    }
  });

  it("gives every Discover sample valid hex brand colors and a real heading font", () => {
    for (const { brand } of DISCOVER_SAMPLE_SEEDS) {
      for (const color of [brand.background, brand.foreground, brand.accent]) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(PORTFOLIO_FONT_KEYS).toContain(brand.headingFont);
    }
  });
});

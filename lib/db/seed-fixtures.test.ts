import { describe, expect, it } from "vitest";
import {
  buildExpiredSubscriptionState,
  buildPortfolioPageviewFixtures,
  readExpiredSeedOwner,
  readSeedOwner,
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
});

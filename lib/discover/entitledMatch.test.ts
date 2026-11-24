/**
 * Parity: entitledMatch(now) must select exactly the workspaces isEntitled
 * accepts. Uses in-memory Mongo; never mocks Mongoose.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models";
import { isEntitled } from "@/lib/billing/access";
import { entitledMatch } from "@/lib/discover/entitledMatch";

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
});

const DAY = 24 * 60 * 60 * 1000;

describe("entitledMatch", () => {
  it("selects exactly the workspaces isEntitled accepts", async () => {
    // isEntitled reads the system clock internally, so use real "now" and
    // keep every fixture date a full day away from it.
    const now = new Date();
    const future = new Date(now.getTime() + DAY);
    const past = new Date(now.getTime() - DAY);

    const fixtures: Array<{ slug: string; fields: Record<string, unknown> }> = [
      { slug: "active", fields: { plan: "pro", lsSubscriptionId: "sub_1", lsSubscriptionStatus: "active" } },
      { slug: "trialing", fields: { plan: "pro", lsSubscriptionId: "sub_2", lsSubscriptionStatus: "trialing" } },
      { slug: "past-due", fields: { plan: "pro", lsSubscriptionId: "sub_3", lsSubscriptionStatus: "past_due" } },
      { slug: "paused", fields: { plan: "pro", lsSubscriptionId: "sub_4", lsSubscriptionStatus: "paused" } },
      {
        slug: "canceled-future",
        fields: { plan: "pro", lsSubscriptionId: "sub_5", lsSubscriptionStatus: "canceled", lsCurrentPeriodEnd: future },
      },
      {
        slug: "canceled-past",
        fields: { plan: "free", lsSubscriptionId: "sub_6", lsSubscriptionStatus: "canceled", lsCurrentPeriodEnd: past },
      },
      { slug: "grant-future", fields: { plan: "pro", planGrantExpiresAt: future } },
      { slug: "grant-past", fields: { plan: "free", planGrantExpiresAt: past } },
      { slug: "beta-no-expiry", fields: { plan: "beta" } },
      { slug: "beta-expired", fields: { plan: "beta", planGrantExpiresAt: past } },
      { slug: "free", fields: { plan: "free" } },
      // Status active but no subscription id: not entitled.
      { slug: "active-no-id", fields: { plan: "pro", lsSubscriptionId: null, lsSubscriptionStatus: "active" } },
      { slug: "active-empty-id", fields: { plan: "pro", lsSubscriptionId: "", lsSubscriptionStatus: "active" } },
      {
        slug: "canceled-future-no-id",
        fields: { plan: "pro", lsSubscriptionId: null, lsSubscriptionStatus: "canceled", lsCurrentPeriodEnd: future },
      },
    ];

    const docs = await Workspace.insertMany(
      fixtures.map(({ slug, fields }) => ({
        slug,
        name: slug,
        ownerUserId: `owner_${slug}`,
        currency: "PHP",
        ...fields,
      })),
    );

    const expected = docs.filter((d) => isEntitled(d)).map((d) => d.slug).sort();
    const matched = (await Workspace.find(entitledMatch(now)).lean()).map((d) => d.slug).sort();

    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(fixtures.length);
    expect(matched).toEqual(expected);
  });
});

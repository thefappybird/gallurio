import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models/Workspace";
import { listDiscoverPortfolios } from "@/lib/db/queries/discover";
import { DISCOVER_SAMPLE_SEEDS, buildDiscoverSampleWorkspace } from "./seed-fixtures";

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
});

describe("Discover sample workspaces", () => {
  it("all 10 pass the real Discover listing query, newest first, with all three tile kinds", async () => {
    const now = new Date();
    await Workspace.insertMany(DISCOVER_SAMPLE_SEEDS.map((s, i) => buildDiscoverSampleWorkspace(s, i, now)));

    const { items } = await listDiscoverPortfolios({ limit: 48, now });

    expect(items.map((i) => i.slug)).toEqual(DISCOVER_SAMPLE_SEEDS.map((s) => s.slug));
    const withOg = items.filter((i) => i.cover?.width === 1200);
    const withCover = items.filter((i) => i.cover && i.cover.width !== 1200);
    const brandOnly = items.filter((i) => i.cover === null);
    expect([withOg.length, withCover.length, brandOnly.length]).toEqual([2, 5, 3]);
  });
});

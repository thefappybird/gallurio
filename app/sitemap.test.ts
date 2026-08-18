import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models/Workspace";
import sitemap from "./sitemap";

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
});

// The sitemap also carries the static marketing and comparison URLs, which
// these cases are not about.
async function tenantEntries() {
  return (await sitemap()).filter((entry) => entry.url.includes("/w/"));
}

function makePublishedWorkspace(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    name: `Studio ${slug}`,
    ownerUserId: `user_${slug}`,
    currency: "PHP",
    publicPage: {
      publishedAt: new Date(),
      data: { home: null, gallery: null },
    },
    ...overrides,
  };
}

describe("sitemap()", () => {
  it("lists the marketing pages and the comparison content", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain("http://localhost:3000/pricing");
    expect(urls).toContain("http://localhost:3000/compare/gallurio-vs-honeybook");
  });

  it("yields two entries per published workspace with correct URLs and priorities", async () => {
    await Workspace.create(makePublishedWorkspace("alpha-studio"));

    const entries = await tenantEntries();

    expect(entries).toHaveLength(2);

    const home = entries.find((e) => !e.url.endsWith("/gallery"));
    const gallery = entries.find((e) => e.url.endsWith("/gallery"));

    expect(home).toBeDefined();
    expect(home?.url).toContain("alpha-studio");
    expect(home?.url).not.toContain("/gallery");
    expect(home?.priority).toBe(0.8);
    expect(home?.changeFrequency).toBe("weekly");

    expect(gallery).toBeDefined();
    expect(gallery?.url).toContain("alpha-studio");
    expect(gallery?.url).toMatch(/\/gallery$/);
    expect(gallery?.priority).toBe(0.6);
    expect(gallery?.changeFrequency).toBe("weekly");
  });

  it("omits unpublished workspaces entirely", async () => {
    await Workspace.create({
      slug: "draft-only",
      name: "Draft Studio",
      ownerUserId: "user_draft",
      currency: "PHP",
      publicPage: { publishedAt: null, data: { home: null, gallery: null } },
    });

    const entries = await tenantEntries();
    expect(entries).toHaveLength(0);
  });

  it("includes lastModified when lastPublishedAt is present", async () => {
    const ts = new Date("2026-03-20T10:00:00.000Z");
    await Workspace.create(
      makePublishedWorkspace("dated-studio", {
        publicPage: {
          publishedAt: ts,
          lastPublishedAt: ts,
          data: { home: null, gallery: null },
        },
      })
    );

    const entries = await tenantEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].lastModified).toEqual(ts);
    expect(entries[1].lastModified).toEqual(ts);
  });
});

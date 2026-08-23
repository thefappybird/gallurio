import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models/Workspace";
import { hasRenderableBlocks } from "@/lib/page-builder/normalizePublicPageData";
import { listPublishedWorkspaceSlugs } from "./publicPage";

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
});

const BLOCK = { type: "Heading", props: { text: "Hi" } };
const PAGE = { root: {}, content: [BLOCK] };

function makePublished(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    name: `Workspace ${slug}`,
    ownerUserId: `user_${slug}`,
    currency: "PHP",
    publicPage: {
      publishedAt: new Date(),
      data: { home: PAGE, gallery: PAGE },
    },
    ...overrides,
  };
}

describe("listPublishedWorkspaceSlugs", () => {
  it("returns only published workspaces, excluding drafts", async () => {
    await Workspace.create([
      makePublished("pub-ws-one"),
      makePublished("pub-ws-two"),
      {
        slug: "draft-ws",
        name: "Draft Workspace",
        ownerUserId: "user_draft",
        currency: "PHP",
        publicPage: { publishedAt: null, data: { home: null, gallery: null } },
      },
    ]);

    const result = await listPublishedWorkspaceSlugs();
    const slugs = result.map((r) => r.slug);

    expect(slugs).toContain("pub-ws-one");
    expect(slugs).toContain("pub-ws-two");
    expect(slugs).not.toContain("draft-ws");
  });

  it("returns an empty array when no workspaces exist", async () => {
    const result = await listPublishedWorkspaceSlugs();
    expect(result).toEqual([]);
  });

  it("projects slug and lastPublishedAt, strips sensitive fields", async () => {
    const ts = new Date("2026-05-01T09:00:00.000Z");
    await Workspace.create(
      makePublished("proj-test", {
        publicPage: {
          publishedAt: new Date(),
          lastPublishedAt: ts,
          data: { home: null, gallery: null },
        },
      })
    );

    const result = await listPublishedWorkspaceSlugs();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("proj-test");
    expect(result[0].lastPublishedAt).toEqual(ts);

    const entry = result[0] as Record<string, unknown>;
    expect(entry._id).toBeUndefined();
    expect(entry.name).toBeUndefined();
  });

  it("excludes workspaces with publicPage.seo.noindex === true", async () => {
    await Workspace.create([
      makePublished("visible-ws"),
      makePublished("noindex-ws", {
        publicPage: {
          publishedAt: new Date(),
          data: { home: PAGE, gallery: PAGE },
          seo: { noindex: true },
        },
      }),
    ]);

    const result = await listPublishedWorkspaceSlugs();
    const slugs = result.map((r) => r.slug);

    expect(slugs).toContain("visible-ws");
    expect(slugs).not.toContain("noindex-ws");
  });

  it("computes hasHome/hasGallery from renderable block presence in publicPage.data", async () => {
    await Workspace.create([
      makePublished("both-ws"),
      makePublished("home-only-ws", {
        publicPage: { publishedAt: new Date(), data: { home: PAGE, gallery: null } },
      }),
      makePublished("gallery-only-ws", {
        publicPage: { publishedAt: new Date(), data: { home: null, gallery: PAGE } },
      }),
      makePublished("neither-ws", {
        publicPage: { publishedAt: new Date(), data: { home: null, gallery: null } },
      }),
    ]);

    const result = await listPublishedWorkspaceSlugs();
    const bySlug = Object.fromEntries(result.map((r) => [r.slug, r]));

    expect(bySlug["both-ws"]).toMatchObject({ hasHome: true, hasGallery: true });
    expect(bySlug["home-only-ws"]).toMatchObject({ hasHome: true, hasGallery: false });
    expect(bySlug["gallery-only-ws"]).toMatchObject({ hasHome: false, hasGallery: true });
    expect(bySlug["neither-ws"]).toMatchObject({ hasHome: false, hasGallery: false });
  });

  describe("hasHome/hasGallery aggregation parity with hasRenderableBlocks", () => {
    // Shared fixture table: the $project aggregation in listPublishedWorkspaceSlugs
    // must agree with hasRenderableBlocks (the single source of truth) on every
    // shape below — a drift here means the sitemap advertises a URL that
    // actually renders "Coming Soon" (or omits a page that does render).
    const FIXTURES: { name: string; value: unknown }[] = [
      { name: "missing (key absent)", value: undefined },
      { name: "non-object (string)", value: "not-an-object" },
      { name: "empty content, no zones", value: { root: {}, content: [] } },
      { name: "content-only", value: { root: {}, content: [BLOCK] } },
      {
        name: "zones-only (empty content)",
        value: { root: {}, content: [], zones: { "x:zone": [BLOCK] } },
      },
      {
        name: "both content and zones",
        value: { root: {}, content: [BLOCK], zones: { "x:zone": [BLOCK] } },
      },
      {
        name: "malformed content entries (null / non-object)",
        value: { root: {}, content: [null, "x"] },
      },
      {
        name: "zones present but value is not an array",
        value: { root: {}, content: [], zones: { "x:zone": "not-an-array" } },
      },
      {
        name: "zones itself is an array, not an object",
        value: { root: {}, content: [], zones: [BLOCK] },
      },
    ];

    it("agrees with hasRenderableBlocks for every fixture shape", async () => {
      await Workspace.create(
        FIXTURES.map((f, i) =>
          makePublished(`parity-fixture-${i}`, {
            publicPage: { publishedAt: new Date(), data: { home: f.value, gallery: null } },
          })
        )
      );

      const result = await listPublishedWorkspaceSlugs();
      const bySlug = Object.fromEntries(result.map((r) => [r.slug, r]));

      for (const [i, f] of FIXTURES.entries()) {
        const slug = `parity-fixture-${i}`;
        expect(bySlug[slug], `fixture "${f.name}" missing from results`).toBeDefined();
        expect(bySlug[slug].hasHome, `fixture "${f.name}"`).toBe(hasRenderableBlocks(f.value));
      }
    });
  });

  it("returns null lastPublishedAt when field is absent on the document", async () => {
    // makePublished without overrides → schema default lastPublishedAt: null
    await Workspace.create(makePublished("no-ts-slug"));

    const result = await listPublishedWorkspaceSlugs();
    expect(result).toHaveLength(1);
    expect(result[0].lastPublishedAt).toBeNull();
  });
});

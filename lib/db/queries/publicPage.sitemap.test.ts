import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models/Workspace";
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

  it("returns null lastPublishedAt when field is absent on the document", async () => {
    // makePublished without overrides → schema default lastPublishedAt: null
    await Workspace.create(makePublished("no-ts-slug"));

    const result = await listPublishedWorkspaceSlugs();
    expect(result).toHaveLength(1);
    expect(result[0].lastPublishedAt).toBeNull();
  });
});

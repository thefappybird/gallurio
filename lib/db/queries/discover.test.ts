import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Types } from "mongoose";
import { Workspace } from "@/lib/db/models/Workspace";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";
import { listDiscoverPortfolios, getDiscoverPortfolio } from "./discover";

// External service only: deterministic delivery URL (no CF account hash in tests).
vi.mock("@/lib/storage/cloudflareImages", () => ({
  imageDeliveryUrl: (id: string, opts: { width?: number } = {}) => `https://cdn.test/${id}/w${opts.width ?? 0}`,
}));

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
});

const NOW = new Date("2026-11-24T00:00:00.000Z");
const PAGE = { root: {}, content: [{ type: "Heading", props: { text: "Hi" } }] };

function gridOf(publicIds: string[]) {
  return { type: "GalleryGrid", props: { images: publicIds.map((publicId) => ({ id: publicId, publicId, alt: "" })) } };
}

function item(workspaceId: unknown, assetId: string, extra: Record<string, unknown> = {}) {
  return { workspaceId, assetId, url: `https://orig.test/${assetId}`, ...extra };
}

/** A workspace that passes every Discover filter; override any field to break one. */
function makeListed(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    name: `Studio ${slug}`,
    ownerUserId: `user_${slug}`,
    currency: "PHP",
    plan: "beta",
    businessType: "photographer",
    country: "PH",
    contact: { email: `${slug}@secret.test`, phone: "+63-917-555-0199" },
    discover: { listed: true, listedAt: new Date("2026-11-01T00:00:00.000Z") },
    publicPage: {
      publishedAt: new Date("2026-11-01T00:00:00.000Z"),
      seoDescription: "A pitch",
      data: { home: PAGE, gallery: PAGE },
    },
    ...overrides,
  };
}

describe("listDiscoverPortfolios filter matrix", () => {
  it("includes only the fully valid workspace", async () => {
    await Workspace.create([
      makeListed("valid"),
      makeListed("unset", { discover: { listedAt: new Date() } }),
      makeListed("optout", { discover: { listed: false, listedAt: new Date() } }),
      makeListed("unpublished", { publicPage: { publishedAt: null, data: { home: PAGE, gallery: PAGE } } }),
      makeListed("noindex", {
        publicPage: { publishedAt: new Date(), seo: { noindex: true }, data: { home: PAGE, gallery: PAGE } },
      }),
      makeListed("nohome", { publicPage: { publishedAt: new Date(), data: { home: null, gallery: PAGE } } }),
      makeListed("gated", { plan: "free" }),
    ]);

    const { items } = await listDiscoverPortfolios({ now: NOW });

    expect(items.map((i) => i.slug)).toEqual(["valid"]);
  });
});

describe("listDiscoverPortfolios pagination", () => {
  it("pages of 2 over 5 docs sharing a listedAt return every doc exactly once", async () => {
    const sharedAt = new Date("2026-11-10T00:00:00.000Z");
    await Workspace.create(
      ["a", "b", "c", "d", "e"].map((s) => makeListed(`p-${s}`, { discover: { listed: true, listedAt: sharedAt } }))
    );

    const seen: string[] = [];
    const sizes: number[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 5; i++) {
      const page: Awaited<ReturnType<typeof listDiscoverPortfolios>> = await listDiscoverPortfolios({
        now: NOW,
        limit: 2,
        cursor,
      });
      sizes.push(page.items.length);
      seen.push(...page.items.map((x) => x.slug));
      cursor = page.nextCursor;
      if (!cursor) break;
    }

    expect({ sizes, seen: [...seen].sort() }).toEqual({
      sizes: [2, 2, 1],
      seen: ["p-a", "p-b", "p-c", "p-d", "p-e"],
    });
  });
});

describe("listDiscoverPortfolios sort", () => {
  it("orders newest listedAt first", async () => {
    await Workspace.create([
      makeListed("old", { discover: { listed: true, listedAt: new Date("2026-01-01T00:00:00.000Z") } }),
      makeListed("new", { discover: { listed: true, listedAt: new Date("2026-06-01T00:00:00.000Z") } }),
      makeListed("mid", { discover: { listed: true, listedAt: new Date("2026-03-01T00:00:00.000Z") } }),
    ]);

    const { items } = await listDiscoverPortfolios({ now: NOW });

    expect(items.map((i) => i.slug)).toEqual(["new", "mid", "old"]);
  });
});

describe("listDiscoverPortfolios category filter", () => {
  it("returns only workspaces of the requested business type", async () => {
    await Workspace.create([
      makeListed("photo", { businessType: "photographer" }),
      makeListed("venue", { businessType: "venue" }),
    ]);

    const { items } = await listDiscoverPortfolios({ now: NOW, category: "venue" });

    expect(items.map((i) => i.slug)).toEqual(["venue"]);
  });
});

describe("listDiscoverPortfolios name search", () => {
  it("treats regex metacharacters in q literally without throwing", async () => {
    await Workspace.create([
      makeListed("lit", { name: "Foo.*(Bar" }),
      makeListed("other-ws", { name: "Foo Studio" }),
    ]);

    const { items } = await listDiscoverPortfolios({ now: NOW, q: "  foo.*(  " });

    expect(items.map((i) => i.slug)).toEqual(["lit"]);
  });

  it("caps q at 60 characters", async () => {
    const name = "x".repeat(60);
    await Workspace.create(makeListed("long", { name }));

    const { items } = await listDiscoverPortfolios({ now: NOW, q: `${name}${"y".repeat(20)}` });

    expect(items.map((i) => i.slug)).toEqual(["long"]);
  });
});

describe("listDiscoverPortfolios privacy", () => {
  it("never exposes contact, owner, recipient email or seeded private strings", async () => {
    await Workspace.create(
      makeListed("priv", {
        inquiryRecipientEmail: "leads@secret.test",
        contact: { email: "owner@secret.test", phone: "+63-917-555-0199", address: "1 Secret St" },
      })
    );

    const json = JSON.stringify(await listDiscoverPortfolios({ now: NOW }));

    expect(json).not.toMatch(/contact|ownerUserId|inquiryRecipientEmail|user_priv|secret\.test|555-0199|Secret St/);
  });
});

describe("listDiscoverPortfolios cover", () => {
  it("uses discover.cover* with 4x5 fallback dims, and null when no cover", async () => {
    const at = new Date("2026-11-02T00:00:00.000Z");
    await Workspace.create([
      makeListed("dims", {
        discover: { listed: true, listedAt: at, coverUrl: "https://cdn.test/c1", coverWidth: 800, coverHeight: 1000 },
      }),
      makeListed("nodims", { discover: { listed: true, listedAt: new Date(at.getTime() - 1), coverUrl: "https://cdn.test/c2" } }),
      makeListed("nocover", { discover: { listed: true, listedAt: new Date(at.getTime() - 2) } }),
    ]);

    const { items } = await listDiscoverPortfolios({ now: NOW });

    expect(items.map((i) => i.cover)).toEqual([
      { url: "https://cdn.test/c1", width: 800, height: 1000 },
      { url: "https://cdn.test/c2", width: 4, height: 5 },
      null,
    ]);
  });
});

describe("listDiscoverPortfolios brand fallbacks", () => {
  it("falls back to the default palette and the legacy fontPair when fields are absent", async () => {
    await Workspace.create(makeListed("legacy"));
    // Raw write: Mongoose would re-materialize schema defaults, the public page reads lean docs.
    await Workspace.collection.updateOne(
      { slug: "legacy" },
      {
        $unset: {
          "publicPage.brandKit.headingFont": "",
          "publicPage.brandKit.backgroundColor": "",
          "publicPage.brandKit.foregroundColor": "",
          "publicPage.brandKit.accentColor": "",
        },
        $set: { "publicPage.brandKit.fontPair": "playfair-inter" },
      }
    );

    const { items } = await listDiscoverPortfolios({ now: NOW });

    expect(items[0]?.brand).toEqual({
      bg: DEFAULT_BRAND_KIT.backgroundColor,
      fg: DEFAULT_BRAND_KIT.foregroundColor,
      accent: DEFAULT_BRAND_KIT.accentColor,
      headingFont: "playfair",
    });
  });
});

describe("listDiscoverPortfolios card shape", () => {
  it("maps a listed workspace to a card with og cover and resolved brand", async () => {
    await Workspace.create(
      makeListed("card", {
        publicPage: {
          publishedAt: new Date(),
          seoDescription: "A pitch",
          seo: { ogImageUrl: "https://cdn.test/og.jpg" },
          brandKit: {
            backgroundColor: "#101820",
            foregroundColor: "#f2f2f2",
            accentColor: "#e0a030",
            headingFont: "playfair",
          },
          data: { home: PAGE, gallery: PAGE },
        },
      })
    );

    const { items } = await listDiscoverPortfolios({ now: NOW });

    expect(items).toEqual([
      {
        slug: "card",
        name: "Studio card",
        category: "photographer",
        country: "PH",
        pitch: "A pitch",
        cover: { url: "https://cdn.test/og.jpg", width: 1200, height: 630 },
        brand: { bg: "#101820", fg: "#f2f2f2", accent: "#e0a030", headingFont: "playfair" },
      },
    ]);
  });
});

describe("getDiscoverPortfolio", () => {
  it("returns null for an unlisted slug and the card for a listed one (case/space-insensitive)", async () => {
    await Workspace.create([
      makeListed("shown"),
      makeListed("hidden", { discover: { listed: false, listedAt: new Date() } }),
    ]);

    const [hidden, shown] = await Promise.all([
      getDiscoverPortfolio("hidden", NOW),
      getDiscoverPortfolio("  SHOWN ", NOW),
    ]);

    expect({ hidden, shown: shown?.slug }).toEqual({ hidden: null, shown: "shown" });
  });
});

describe("getDiscoverPortfolio images", () => {
  it("orders og image, then home then gallery refs; ignores unreferenced items", async () => {
    const ws = await Workspace.create(
      makeListed("imgs", {
        publicPage: {
          publishedAt: new Date(),
          seo: { ogImageUrl: "https://cdn.test/og.jpg" },
          data: {
            home: { root: {}, content: [gridOf(["h1"])] },
            gallery: { root: {}, content: [gridOf(["g1"])] },
          },
        },
      })
    );
    await GalleryItem.create([
      item(ws._id, "h1", { width: 800, height: 600, caption: "Caption wins", altText: "alt" }),
      item(ws._id, "g1", { width: 400, height: 500, altText: "Alt only" }),
      item(ws._id, "unref", { width: 1, height: 1 }),
    ]);

    const detail = await getDiscoverPortfolio("imgs", NOW);

    expect(detail?.images).toEqual([
      { url: "https://cdn.test/og.jpg", width: 1200, height: 630, alt: "" },
      { url: "https://cdn.test/h1/w1600", width: 800, height: 600, alt: "Caption wins" },
      { url: "https://cdn.test/g1/w1600", width: 400, height: 500, alt: "Alt only" },
    ]);
  });
});

describe("getDiscoverPortfolio tenancy", () => {
  it("drops a referenced asset that only exists in another workspace", async () => {
    const [mine, theirs] = await Workspace.create([
      makeListed("mine", {
        publicPage: {
          publishedAt: new Date(),
          data: { home: { root: {}, content: [gridOf(["own", "foreign"])] }, gallery: null },
        },
      }),
      makeListed("theirs"),
    ]);
    await GalleryItem.create([item(mine._id, "own", { width: 10, height: 10 }), item(theirs._id, "foreign")]);

    const detail = await getDiscoverPortfolio("mine", NOW);

    expect(detail?.images.map((i) => i.url)).toEqual(["https://cdn.test/own/w1600"]);
  });
});

describe("getDiscoverPortfolio collections", () => {
  it("expands a collection ref in order, only that workspace's items, deduped and capped at 5", async () => {
    const colId = new Types.ObjectId();
    const otherColId = new Types.ObjectId();
    const [ws, other] = await Workspace.create([
      makeListed("cols", {
        publicPage: {
          publishedAt: new Date(),
          data: {
            home: {
              root: {},
              content: [
                gridOf(["c1"]),
                { type: "CollectionCard", props: { collection: { id: String(colId) } } },
                // a collection owned by another workspace must resolve to nothing
                { type: "FeaturedWork", props: { collections: [{ id: String(otherColId) }] } },
              ],
            },
            gallery: null,
          },
        },
      }),
      makeListed("cols-other"),
    ]);
    await GalleryCollection.create([
      { _id: colId, workspaceId: ws._id, name: "Mine", slug: "mine" },
      { _id: otherColId, workspaceId: other._id, name: "Theirs", slug: "theirs" },
    ]);
    await GalleryItem.create([
      item(ws._id, "c1", { collectionId: colId, order: 0 }),
      ...[1, 2, 3, 4, 5, 6].map((n) => item(ws._id, `c${n + 1}`, { collectionId: colId, order: n })),
      item(other._id, "x1", { collectionId: otherColId }),
    ]);

    const detail = await getDiscoverPortfolio("cols", NOW);

    expect(detail?.images.map((i) => i.url.split("/")[3])).toEqual(["c1", "c2", "c3", "c4", "c5"]);
  });
});

describe("getDiscoverPortfolio private collections", () => {
  it("excludes items of a collection made private after publish", async () => {
    const pubId = new Types.ObjectId();
    const privId = new Types.ObjectId();
    const ws = await Workspace.create(
      makeListed("priv-col", {
        publicPage: {
          publishedAt: new Date(),
          data: {
            home: {
              root: {},
              content: [
                { type: "CollectionCard", props: { collection: { id: String(privId) } } },
                { type: "CollectionCard", props: { collection: { id: String(pubId) } } },
              ],
            },
            gallery: null,
          },
        },
      })
    );
    await GalleryCollection.create([
      { _id: pubId, workspaceId: ws._id, name: "Public", slug: "public", isPublic: true },
      { _id: privId, workspaceId: ws._id, name: "Private", slug: "private", isPublic: false },
    ]);
    await GalleryItem.create([
      item(ws._id, "secret1", { collectionId: privId }),
      item(ws._id, "open1", { collectionId: pubId }),
    ]);

    const detail = await getDiscoverPortfolio("priv-col", NOW);

    expect(detail?.images.map((i) => i.url)).toEqual(["https://cdn.test/open1/w1600"]);
  });
});

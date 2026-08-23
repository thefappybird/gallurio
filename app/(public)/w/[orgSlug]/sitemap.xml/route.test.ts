import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models/Workspace";

vi.mock("@/lib/storage/cloudflareImages", () => ({
  imageDeliveryUrl: (id: string) => (id ? `https://cdn.example.com/${id}` : ""),
}));

import { GET } from "./route";

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
    name: `Studio ${slug}`,
    ownerUserId: `user_${slug}`,
    currency: "PHP",
    publicPage: {
      publishedAt: new Date(),
      data: { home: PAGE, gallery: PAGE },
    },
    ...overrides,
  };
}

async function call(orgSlug: string) {
  return GET(new Request(`http://localhost/w/${orgSlug}/sitemap.xml`), {
    params: Promise.resolve({ orgSlug }),
  });
}

describe("GET /w/[orgSlug]/sitemap.xml", () => {
  it("lists Home and Gallery <loc> entries matching the canonical public URLs for a published workspace", async () => {
    await Workspace.create(makePublished("studio"));

    const res = await call("studio");
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(body).toContain("<loc>http://localhost:3000/w/studio</loc>");
    expect(body).toContain("<loc>http://localhost:3000/w/studio/gallery</loc>");
  });

  it("404s for an unknown or unpublished slug", async () => {
    await Workspace.create(makePublished("draft", { publicPage: { publishedAt: null, data: { home: PAGE, gallery: PAGE } } }));

    expect((await call("nope")).status).toBe(404);
    expect((await call("draft")).status).toBe(404);
  });

  it("404s for a noindex workspace", async () => {
    await Workspace.create(makePublished("hidden", { publicPage: { publishedAt: new Date(), data: { home: PAGE, gallery: PAGE }, seo: { noindex: true } } }));
    expect((await call("hidden")).status).toBe(404);
  });

  it("emits only the Home <url> when the gallery page has no renderable content", async () => {
    await Workspace.create(makePublished("home-only", { publicPage: { publishedAt: new Date(), data: { home: PAGE, gallery: null } } }));

    const body = await (await call("home-only")).text();

    expect(body).toContain("<loc>http://localhost:3000/w/home-only</loc>");
    expect(body).not.toContain("/gallery</loc>");
  });

  it("emits only the Gallery <url> when the home page has no renderable content", async () => {
    await Workspace.create(makePublished("gallery-only", { publicPage: { publishedAt: new Date(), data: { home: null, gallery: PAGE } } }));

    const body = await (await call("gallery-only")).text();

    expect(body).toContain("<loc>http://localhost:3000/w/gallery-only/gallery</loc>");
    expect(body).not.toContain("<loc>http://localhost:3000/w/gallery-only</loc>");
  });

  it("returns a valid empty urlset (200) when neither page has renderable content", async () => {
    await Workspace.create(makePublished("empty", { publicPage: { publishedAt: new Date(), data: { home: null, gallery: null } } }));

    const res = await call("empty");
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).not.toContain("<url>");
    expect(body).toContain("<urlset");
  });

  it("emits lastmod as ISO 8601 from lastPublishedAt, omitted when null", async () => {
    const ts = new Date("2026-03-20T10:00:00.000Z");
    await Workspace.create(makePublished("dated", { publicPage: { publishedAt: ts, lastPublishedAt: ts, data: { home: PAGE, gallery: null } } }));
    await Workspace.create(makePublished("undated", { publicPage: { publishedAt: new Date(), data: { home: PAGE, gallery: null } } }));

    const datedBody = await (await call("dated")).text();
    const undatedBody = await (await call("undated")).text();

    expect(datedBody).toContain("<lastmod>2026-03-20T10:00:00.000Z</lastmod>");
    expect(undatedBody).not.toContain("<lastmod>");
  });

  it("emits <image:image> entries for the Gallery <url> from published gallery-block images", async () => {
    // Nested one level inside a preset's slot (`props.content`), mirroring
    // how the editor actually publishes gallery blocks — not the flat
    // top-level shape which would mask a traversal regression.
    const galleryPage = {
      root: {},
      content: [
        {
          type: "GalleryGridPreset",
          props: {
            content: [
              { type: "GalleryGrid", props: { images: [{ id: "x", publicId: "asset-1", alt: "Wedding shot" }] } },
            ],
          },
        },
      ],
    };
    await Workspace.create(makePublished("with-images", { publicPage: { publishedAt: new Date(), data: { home: PAGE, gallery: galleryPage } } }));

    const body = await (await call("with-images")).text();

    expect(body).toContain("<image:image>");
    expect(body).toContain("<image:loc>https://cdn.example.com/asset-1</image:loc>");
    expect(body).toContain("<image:caption>Wedding shot</image:caption>");
    // Home's <url> has no images.
    const homeEntry = body.slice(0, body.indexOf("with-images/gallery"));
    expect(homeEntry).not.toContain("<image:image>");
  });
});

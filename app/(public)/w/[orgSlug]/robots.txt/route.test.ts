import { afterAll, beforeAll, afterEach, describe, expect, it } from "vitest";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { Workspace } from "@/lib/db/models/Workspace";
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
  return GET(new Request(`http://localhost/w/${orgSlug}/robots.txt`), {
    params: Promise.resolve({ orgSlug }),
  });
}

describe("GET /w/[orgSlug]/robots.txt", () => {
  it("returns an indexable robots.txt with the tenant sitemap URL for a published workspace", async () => {
    await Workspace.create(makePublished("studio"));

    const res = await call("studio");
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Sitemap: http://localhost:3000/w/studio/sitemap.xml");
  });

  it("emits a lowercase Sitemap URL from the DB slug even when the route param arrives mixed-case", async () => {
    await Workspace.create(makePublished("mixed-case-studio"));

    const body = await (await call("Mixed-Case-Studio")).text();

    expect(body).toContain("Sitemap: http://localhost:3000/w/mixed-case-studio/sitemap.xml");
    expect(body).not.toContain("Mixed-Case-Studio");
  });

  it("404s for an unknown slug", async () => {
    const res = await call("nope");
    expect(res.status).toBe(404);
  });

  it("404s for an unpublished workspace", async () => {
    await Workspace.create(makePublished("draft", { publicPage: { publishedAt: null, data: { home: PAGE, gallery: PAGE } } }));
    const res = await call("draft");
    expect(res.status).toBe(404);
  });

  it("disallows everything for a noindex workspace", async () => {
    await Workspace.create(makePublished("hidden", { publicPage: { publishedAt: new Date(), data: { home: PAGE, gallery: PAGE }, seo: { noindex: true } } }));

    const res = await call("hidden");
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toBe("User-agent: *\nDisallow: /\n");
  });
});

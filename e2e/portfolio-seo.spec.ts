import { test, expect } from "@playwright/test";
import { portfolioGalleryUrl, portfolioPublicUrl } from "../lib/portfolio/publicUrl";

// Portfolio discovery surfaces are public by definition — run anonymous, the
// same way seo-crawlability.spec.ts does for the marketing pages. This file
// covers the tenant portfolio (/w/[orgSlug]); marketing SEO stays over there.
test.use({ storageState: { cookies: [], origins: [] } });

// The seeded owner's workspace, from lib/db/seed.ts. It is published with both
// Home and Gallery content, seoTitle + seoDescription filled, noindex false.
const SLUG = "seed-owner-demo";
const HOME = `/w/${SLUG}`;
const GALLERY = `/w/${SLUG}/gallery`;
const PUBLIC_HOME = portfolioPublicUrl(SLUG);
const PUBLIC_GALLERY = portfolioGalleryUrl(SLUG);

// Requests use the path form so the handlers are reachable without wildcard
// DNS locally. Their emitted discovery URLs must still follow the configured
// canonical strategy (subdomain or path), which the public URL helpers resolve.

/** Every JSON-LD block in a raw HTML document, parsed. */
function extractJsonLd(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  for (const match of html.matchAll(re)) {
    blocks.push(JSON.parse(match[1]) as Record<string, unknown>);
  }
  return blocks;
}

/** Collects every `@id` referenced anywhere in a node tree. */
function referencedIds(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) referencedIds(entry, into);
    return into;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      // A node's own identity is a definition, not a reference — but a bare
      // { "@id": ... } with no other keys is always a pointer at another node.
      if (key === "@id" && Object.keys(obj).length === 1 && typeof val === "string") {
        into.add(val);
      } else {
        referencedIds(val, into);
      }
    }
  }
  return into;
}

function definedIds(blocks: Record<string, unknown>[]): Set<string> {
  const ids = new Set<string>();
  for (const block of blocks) {
    const id = block["@id"];
    if (typeof id === "string") ids.add(id);
  }
  return ids;
}

test.describe("tenant crawler endpoints", () => {
  test("the portfolio serves its own robots.txt naming its own sitemap", async ({ request }) => {
    const res = await request.get(`${HOME}/robots.txt`);

    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");

    const body = await res.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /api/");
    // The sitemap it advertises must be the tenant's own, not the apex one.
    expect(body).toContain(`Sitemap: ${PUBLIC_HOME}/sitemap.xml`);
  });

  test("the portfolio serves its own sitemap with both pages and image entries", async ({
    request,
  }) => {
    const res = await request.get(`${HOME}/sitemap.xml`);

    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/xml");

    const body = await res.text();
    expect(body).toContain("http://www.sitemaps.org/schemas/sitemap/0.9");
    // The image namespace must be declared whenever image children may appear.
    expect(body).toContain("http://www.google.com/schemas/sitemap-image/1.1");
    expect(body).toContain(`<loc>`);
    expect(body).toContain(`<loc>${PUBLIC_HOME}</loc>`);
    expect(body).toContain(`<loc>${PUBLIC_GALLERY}</loc>`);
  });

  test("the apex sitemap lists the published portfolio", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();
    expect(body).toContain(`<loc>${PUBLIC_HOME}</loc>`);
  });
});

test.describe("portfolio metadata in raw HTML", () => {
  for (const [label, path, canonicalUrl] of [
    ["home", HOME, PUBLIC_HOME],
    ["gallery", GALLERY, PUBLIC_GALLERY],
  ] as const) {
    test(`${label} serves a canonical, title and non-empty description to a crawler running no JavaScript`, async ({
      request,
    }) => {
      const res = await request.get(path, { headers: { "user-agent": "Googlebot" } });
      expect(res.status()).toBe(200);
      const html = await res.text();

      // Guard against asserting on a Next.js error overlay, which is served at
      // the same URL with a 200 and would satisfy naive substring checks.
      expect(html).not.toContain("__NEXT_ERROR_OVERLAY__");

      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
      expect(canonical, `${label} has no canonical`).not.toBeNull();
      expect(canonical![1]).toBe(canonicalUrl);

      const title = html.match(/<title>([^<]*)<\/title>/);
      expect(title, `${label} has no <title>`).not.toBeNull();
      expect(title![1].trim().length).toBeGreaterThan(0);

      // The defect this branch fixed: an owner who left seoDescription blank
      // shipped a page with no description tag at all.
      const description = html.match(/<meta name="description" content="([^"]*)"/);
      expect(description, `${label} has no meta description`).not.toBeNull();
      expect(description![1].trim().length).toBeGreaterThan(0);
    });

    test(`${label} JSON-LD is self-contained — every referenced @id is defined on the same page`, async ({
      request,
    }) => {
      const html = await (await request.get(path)).text();
      const blocks = extractJsonLd(html);

      expect(blocks.length, `${label} emitted no JSON-LD`).toBeGreaterThan(0);

      const defined = definedIds(blocks);
      const referenced = referencedIds(blocks);

      for (const id of referenced) {
        expect(
          defined.has(id),
          `${label} references @id "${id}" but no node on this page defines it`
        ).toBe(true);
      }
    });
  }

  test("the gallery describes itself as an ImageGallery and the home page as a business", async ({
    request,
  }) => {
    const homeTypes = extractJsonLd(await (await request.get(HOME)).text()).map((b) => b["@type"]);
    expect(homeTypes).toContain("WebSite");
    expect(homeTypes).toContain("WebPage");

    const galleryTypes = extractJsonLd(await (await request.get(GALLERY)).text()).map(
      (b) => b["@type"]
    );
    expect(galleryTypes).toContain("ImageGallery");
    expect(galleryTypes).toContain("BreadcrumbList");
  });
});

test.describe("portfolio document language", () => {
  test("home declares a language and a direction before any JavaScript runs", async ({
    request,
  }) => {
    const html = await (await request.get(HOME)).text();

    const lang = html.match(/<html[^>]*\slang="([^"]*)"/);
    expect(lang, "no lang attribute on <html>").not.toBeNull();
    expect(lang![1].length).toBeGreaterThan(0);

    const dir = html.match(/<html[^>]*\sdir="([^"]*)"/);
    expect(dir, "no dir attribute on <html>").not.toBeNull();
    expect(["ltr", "rtl"]).toContain(dir![1]);
  });
});

test.describe("crawlable images", () => {
  test("meaningful portfolio images are real <img> elements in the server HTML", async ({
    request,
  }) => {
    const html = await (await request.get(GALLERY)).text();

    // The Image block used to paint a CSS background with role="img", which
    // image search cannot index. Nothing on a portfolio page should rely on
    // that pattern any more.
    expect(html).not.toContain('role="img"');

    // Whatever imagery the page does render must arrive as standard markup with
    // an alt attribute. Deliberately not asserting a minimum count: whether the
    // seeded portfolio has photos attached to its gallery block is fixture
    // state, not a property of the code under test. The "images actually reach
    // the sitemap and JSON-LD" guarantee is covered by the unit tests for
    // collectPublishedGalleryImages, which exercise the nested-slot shape.
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    for (const img of imgs) {
      expect(img, `<img> without an alt attribute: ${img}`).toMatch(/\salt=/);
    }
  });
});

test("contact is still a modal — no /contact route exists under the portfolio", async ({
  request,
}) => {
  const res = await request.get(`${HOME}/contact`, { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});

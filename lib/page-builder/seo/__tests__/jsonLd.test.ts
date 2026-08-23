import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/portfolio/publicUrl", () => ({
  portfolioPublicUrl: (slug: string) => `http://localhost:3000/w/${slug}`,
  portfolioGalleryUrl: (slug: string) => `http://localhost:3000/w/${slug}/gallery`,
}));

import {
  resolveSchemaType,
  buildHomeJsonLd,
  buildPortfolioEntityNodes,
  buildPortfolioJsonLdInput,
} from "../jsonLd";

// ---------------------------------------------------------------------------
// Reusable regression guard: every `@id` value referenced ANYWHERE in a set
// of JSON-LD nodes must equal one of those same nodes' own top-level `@id` —
// i.e. every reference resolves within the page that emits it. Run against
// each page's full node set (see also the two page.test.tsx files).
// ---------------------------------------------------------------------------

function collectAllIds(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectAllIds(v, into);
    return into;
  }
  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key === "@id" && typeof v === "string") into.add(v);
      else collectAllIds(v, into);
    }
  }
  return into;
}

function assertAllIdsResolveWithinPage(nodes: Record<string, unknown>[]) {
  const definedIds = new Set(nodes.map((n) => n["@id"] as string));
  const referencedIds = collectAllIds(nodes);
  for (const id of referencedIds) {
    expect(definedIds.has(id), `@id "${id}" is referenced but not defined among this page's nodes`).toBe(true);
  }
}

describe("resolveSchemaType", () => {
  it("maps photographer to PhotographyBusiness", () => {
    expect(resolveSchemaType("photographer")).toBe("PhotographyBusiness");
  });
  it("maps venue to EventVenue", () => {
    expect(resolveSchemaType("venue")).toBe("EventVenue");
  });
  it("maps stylist to HairSalon", () => {
    expect(resolveSchemaType("stylist")).toBe("HairSalon");
  });
});

describe("buildHomeJsonLd", () => {
  it("returns a LocalBusiness block with correct @type and url", () => {
    const [lb] = buildHomeJsonLd({ name: "Studio A", slug: "studio-a" });
    expect(lb["@type"]).toBe("LocalBusiness");
    expect(lb.url).toBe("http://localhost:3000/w/studio-a");
  });
  it("applies businessType to set @type", () => {
    const [lb] = buildHomeJsonLd({ name: "Photo Co", slug: "photo-co", businessType: "photographer" });
    expect(lb["@type"]).toBe("PhotographyBusiness");
  });
  it("omits email when not provided", () => {
    const [lb] = buildHomeJsonLd({ name: "X", slug: "x" });
    expect(lb).not.toHaveProperty("email");
  });
  it("includes email when provided", () => {
    const [lb] = buildHomeJsonLd({ name: "X", slug: "x", email: "hi@studio.com" });
    expect(lb.email).toBe("hi@studio.com");
  });
  it("joins keywords into a comma-delimited string when provided", () => {
    const [lb] = buildHomeJsonLd({ name: "X", slug: "x", keywords: ["wedding", "bali"] });
    expect(lb.keywords).toBe("wedding, bali");
  });
  it("omits keywords when absent or empty", () => {
    const [lb] = buildHomeJsonLd({ name: "X", slug: "x" });
    expect(lb).not.toHaveProperty("keywords");
    const [lb2] = buildHomeJsonLd({ name: "X", slug: "x", keywords: [] });
    expect(lb2).not.toHaveProperty("keywords");
  });
});

import { buildGalleryJsonLd, safeJsonLd } from "../jsonLd";

describe("buildGalleryJsonLd", () => {
  it("returns ImageGallery block with correct name and url", () => {
    const [ig] = buildGalleryJsonLd({ name: "Studio A", slug: "studio-a" });
    expect(ig["@type"]).toBe("ImageGallery");
    expect(ig.url).toBe("http://localhost:3000/w/studio-a/gallery");
    expect(ig.name).toBe("Studio A — Gallery");
  });

  it("omits image entirely when images is absent or empty", () => {
    const [ig] = buildGalleryJsonLd({ name: "Studio A", slug: "studio-a" });
    expect(ig).not.toHaveProperty("image");
    const [ig2] = buildGalleryJsonLd({ name: "Studio A", slug: "studio-a", images: [] });
    expect(ig2).not.toHaveProperty("image");
  });

  it("builds ImageObject[] from images, omitting description when alt is blank", () => {
    const [ig] = buildGalleryJsonLd({
      name: "Studio A",
      slug: "studio-a",
      images: [
        { url: "https://cdn/a.jpg", alt: "Wedding shot" },
        { url: "https://cdn/b.jpg", alt: "" },
      ],
    });
    const images = ig.image as Record<string, unknown>[];
    expect(images).toHaveLength(2);
    expect(images[0]).toEqual({ "@type": "ImageObject", contentUrl: "https://cdn/a.jpg", url: "https://cdn/a.jpg", description: "Wedding shot" });
    expect(images[1]).toEqual({ "@type": "ImageObject", contentUrl: "https://cdn/b.jpg", url: "https://cdn/b.jpg" });
    expect(images[1]).not.toHaveProperty("description");
  });
});

describe("JSON-LD graph @ids", () => {
  it("gives every node a stable, canonical @id", () => {
    const [business, website, webpage] = buildHomeJsonLd({ name: "Studio A", slug: "studio-a" });
    expect(business["@id"]).toBe("http://localhost:3000/w/studio-a#business");
    expect(website["@id"]).toBe("http://localhost:3000/w/studio-a#website");
    expect(webpage["@id"]).toBe("http://localhost:3000/w/studio-a#webpage");
    const [gallery, breadcrumb] = buildGalleryJsonLd({ name: "Studio A", slug: "studio-a" });
    expect(gallery["@id"]).toBe("http://localhost:3000/w/studio-a/gallery#gallery");
    expect(breadcrumb["@id"]).toBe("http://localhost:3000/w/studio-a/gallery#breadcrumb");
  });

  it("cross-references resolve to a node that exists in the combined graph", () => {
    const [business, website, webpage] = buildHomeJsonLd({ name: "Studio A", slug: "studio-a" });
    const [gallery] = buildGalleryJsonLd({ name: "Studio A", slug: "studio-a" });
    const ids = new Set([business, website, webpage, gallery].map((n) => n["@id"]));

    expect(ids.has((website.publisher as Record<string, unknown>)["@id"] as string)).toBe(true);
    expect(ids.has((webpage.isPartOf as Record<string, unknown>)["@id"] as string)).toBe(true);
    expect(ids.has((webpage.about as Record<string, unknown>)["@id"] as string)).toBe(true);
    expect(ids.has((gallery.isPartOf as Record<string, unknown>)["@id"] as string)).toBe(true);
    expect(ids.has((gallery.author as Record<string, unknown>)["@id"] as string)).toBe(true);
  });

  it("Home page's own node set is self-contained — every referenced @id resolves within it", () => {
    const homeNodes = buildHomeJsonLd({ name: "Studio A", slug: "studio-a" });
    assertAllIdsResolveWithinPage(homeNodes);
  });

  it("Gallery page's own node set is self-contained — every referenced @id resolves within it (regression: previously gallery.author/isPartOf dangled)", () => {
    const [business, website] = buildPortfolioEntityNodes({ name: "Studio A", slug: "studio-a" });
    const galleryNodes = buildGalleryJsonLd({ name: "Studio A", slug: "studio-a" });
    assertAllIdsResolveWithinPage([business, website, ...galleryNodes]);
  });

  it("buildPortfolioEntityNodes returns business/website deep-equal to the ones buildHomeJsonLd emits for the same input", () => {
    const input = { name: "Studio A", slug: "studio-a", businessType: "photographer", email: "hi@studio.com" };
    const [homeBusiness, homeWebsite] = buildHomeJsonLd(input);
    const [business, website] = buildPortfolioEntityNodes(input);
    expect(business).toEqual(homeBusiness);
    expect(website).toEqual(homeWebsite);
  });

  it("emits no undefined or empty-string values anywhere in the graph", () => {
    const nodes = [
      ...buildHomeJsonLd({ name: "Studio A", slug: "studio-a" }),
      ...buildGalleryJsonLd({ name: "Studio A", slug: "studio-a", images: [{ url: "https://cdn/a.jpg", alt: "x" }] }),
    ];
    for (const node of nodes) {
      for (const [key, value] of Object.entries(node)) {
        expect(value, `${key} should not be undefined`).not.toBeUndefined();
        expect(value, `${key} should not be an empty string`).not.toBe("");
      }
    }
  });
});

describe("buildPortfolioJsonLdInput", () => {
  it("maps name/slug/businessType/contact fields directly", () => {
    const input = buildPortfolioJsonLdInput({
      name: "Studio A",
      slug: "studio-a",
      businessType: "photographer",
      contact: { email: "hi@studio.com", phone: "+63 900", address: "Manila" },
    });
    expect(input).toMatchObject({
      name: "Studio A",
      slug: "studio-a",
      businessType: "photographer",
      email: "hi@studio.com",
      phone: "+63 900",
      address: "Manila",
    });
  });

  it("builds sameAs from socials in a fixed order (instagram, facebook, tiktok, website)", () => {
    const input = buildPortfolioJsonLdInput({
      name: "X",
      slug: "x",
      contact: {
        socials: { instagram: "studio_ig", facebook: "studio.fb", tiktok: "studio_tt", website: "https://studio.example" },
      },
    });
    expect(input.sameAs).toEqual([
      "https://www.instagram.com/studio_ig",
      "https://www.facebook.com/studio.fb",
      "https://www.tiktok.com/@studio_tt",
      "https://studio.example",
    ]);
  });

  it("omits unset socials rather than pushing empty entries", () => {
    const input = buildPortfolioJsonLdInput({ name: "X", slug: "x", contact: { socials: { instagram: "only_ig" } } });
    expect(input.sameAs).toEqual(["https://www.instagram.com/only_ig"]);
  });

  it("falls back image to siteIcon.url when seo.ogImageUrl is unset", () => {
    const input = buildPortfolioJsonLdInput({
      name: "X",
      slug: "x",
      publicPage: { siteIcon: { url: "https://cdn/icon.png" } },
    });
    expect(input.image).toBe("https://cdn/icon.png");
  });

  it("prefers seo.ogImageUrl over siteIcon.url", () => {
    const input = buildPortfolioJsonLdInput({
      name: "X",
      slug: "x",
      publicPage: { seo: { ogImageUrl: "https://cdn/og.png" }, siteIcon: { url: "https://cdn/icon.png" } },
    });
    expect(input.image).toBe("https://cdn/og.png");
  });

  it("passes seo.keywords through and omits description when seoDescription is unset", () => {
    const input = buildPortfolioJsonLdInput({
      name: "X",
      slug: "x",
      publicPage: { seo: { keywords: ["wedding", "manila"] } },
    });
    expect(input.keywords).toEqual(["wedding", "manila"]);
    expect(input.description).toBeUndefined();
  });
});

describe("safeJsonLd", () => {
  it("serialises data and escapes </script> to prevent XSS", () => {
    const result = safeJsonLd({ evil: "</script><script>alert(1)</script>" });
    expect(result).not.toContain("</script>");
    expect(result).toContain("<\\/script>");
  });

  it("escapes </script > (whitespace variant) which HTML5 also treats as a script end tag", () => {
    // HTML5 ends a <script> element on </script followed by whitespace, /, or >.
    // A workspace owner could inject this to break out of the JSON-LD block.
    const result = safeJsonLd({ name: "evil</script ><script>alert(1)</script>" });
    expect(result).not.toContain("</script");
  });

  it("escapes </script/> (self-closing variant)", () => {
    const result = safeJsonLd({ name: "evil</script/><script>alert(1)</script>" });
    expect(result).not.toContain("</script");
  });

  it("escapes case-insensitive variants like </SCRIPT>", () => {
    const result = safeJsonLd({ name: "evil</SCRIPT><script>alert(1)</script>" });
    expect(result).not.toContain("</script");
    expect(result).not.toContain("</SCRIPT");
  });
});

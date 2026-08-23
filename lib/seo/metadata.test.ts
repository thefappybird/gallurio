import { describe, it, expect } from "vitest";
import { editorialMetadata, localeUrl, marketingMetadata } from "./metadata";

describe("localeUrl()", () => {
  it("leaves the default locale unprefixed and prefixes the rest", () => {
    expect(localeUrl("en", "/pricing")).toBe("http://localhost:3000/pricing");
    expect(localeUrl("fil", "/pricing")).toBe("http://localhost:3000/fil/pricing");
  });
});

describe("marketingMetadata()", () => {
  it("canonicalises to the requested locale", () => {
    const meta = marketingMetadata({ locale: "fil", path: "/pricing", title: "T", description: "D" });

    expect(meta.alternates?.canonical).toBe("http://localhost:3000/fil/pricing");
  });

  it("lists every locale plus x-default in hreflang", () => {
    const meta = marketingMetadata({ locale: "en", path: "/pricing", title: "T", description: "D" });

    expect(meta.alternates?.languages).toEqual({
      en: "http://localhost:3000/pricing",
      fil: "http://localhost:3000/fil/pricing",
      id: "http://localhost:3000/id/pricing",
      ar: "http://localhost:3000/ar/pricing",
      th: "http://localhost:3000/th/pricing",
      "x-default": "http://localhost:3000/pricing",
    });
  });

  it("keeps the page title absolute so the layout template does not append twice", () => {
    const meta = marketingMetadata({
      locale: "en",
      path: "/pricing",
      title: "Pricing",
      description: "What Gallurio costs.",
    });

    expect(meta.title).toEqual({ absolute: "Pricing" });
    expect(meta.description).toBe("What Gallurio costs.");
  });
});

describe("editorialMetadata()", () => {
  it("publishes one English canonical without non-English alternates", () => {
    const meta = editorialMetadata({
      path: "/blog/example",
      title: "Example",
      description: "An English article.",
    });

    expect(meta.alternates).toEqual({
      canonical: "http://localhost:3000/blog/example",
      languages: {
        en: "http://localhost:3000/blog/example",
        "x-default": "http://localhost:3000/blog/example",
      },
    });
  });

  it("publishes article-specific social metadata when dates are provided", () => {
    const meta = editorialMetadata({
      path: "/compare/example",
      title: "Example comparison",
      description: "A useful comparison.",
      publishedAt: "2026-08-18",
      updatedAt: "2026-08-23",
    });

    expect(meta.openGraph).toMatchObject({
      type: "article",
      url: "http://localhost:3000/compare/example",
      title: "Example comparison",
      description: "A useful comparison.",
      publishedTime: "2026-08-18",
      modifiedTime: "2026-08-23",
    });
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Example comparison",
      description: "A useful comparison.",
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  buildSoftwareApplicationLd,
  buildFaqLd,
  buildArticleLd,
  buildBreadcrumbLd,
  buildOrganizationLd,
  buildWebSiteLd,
  buildCollectionPageLd,
} from "./marketingJsonLd";

describe("buildSoftwareApplicationLd", () => {
  it("builds a SoftwareApplication node with the caller-supplied price", () => {
    const result = buildSoftwareApplicationLd({
      price: 250,
      currency: "PHP",
      url: "http://localhost:3000/pricing",
    });

    expect(result).toEqual({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Gallurio",
      applicationCategory: "BusinessApplication",
      url: "http://localhost:3000/pricing",
      offers: {
        "@type": "Offer",
        price: 250,
        priceCurrency: "PHP",
      },
    });
  });
});

describe("buildFaqLd", () => {
  it("builds a FAQPage node with a Question/acceptedAnswer per item", () => {
    const result = buildFaqLd([
      { question: "Is there a free plan?", answer: "There is a free month." },
    ]);

    expect(result).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is there a free plan?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "There is a free month.",
          },
        },
      ],
    });
  });

  it("returns null for an empty item list", () => {
    expect(buildFaqLd([])).toBeNull();
  });
});

describe("buildArticleLd", () => {
  it("falls back to publishedAt for dateModified when updatedAt is absent", () => {
    const result = buildArticleLd({
      title: "Announcing Gallurio",
      description: "A CRM for event businesses.",
      url: "http://localhost:3000/blog/announcing",
      publishedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result).toEqual({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Announcing Gallurio",
      description: "A CRM for event businesses.",
      url: "http://localhost:3000/blog/announcing",
      datePublished: "2026-01-01T00:00:00.000Z",
      dateModified: "2026-01-01T00:00:00.000Z",
      author: { "@type": "Organization", name: "Gallurio Editorial", url: "http://localhost:3000/about" },
      publisher: { "@type": "Organization", name: "Gallurio", url: "http://localhost:3000" },
    });
  });
});

describe("buildBreadcrumbLd", () => {
  it("builds a BreadcrumbList with 1-indexed positions", () => {
    const result = buildBreadcrumbLd([
      { name: "Home", url: "http://localhost:3000" },
      { name: "Pricing", url: "http://localhost:3000/pricing" },
    ]);

    expect(result).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "http://localhost:3000" },
        {
          "@type": "ListItem",
          position: 2,
          name: "Pricing",
          item: "http://localhost:3000/pricing",
        },
      ],
    });
  });
});

describe("buildOrganizationLd", () => {
  it("builds an Organization node keyed by a stable @id off the given url", () => {
    const result = buildOrganizationLd({
      url: "http://localhost:3000",
      logoUrl: "http://localhost:3000/brand/gallurio%20sq%20png.png",
    });

    expect(result).toEqual({
      "@context": "https://schema.org",
      "@id": "http://localhost:3000#organization",
      "@type": "Organization",
      name: "Gallurio",
      url: "http://localhost:3000",
      logo: "http://localhost:3000/brand/gallurio%20sq%20png.png",
    });
  });

  it("omits sameAs when no profiles are given", () => {
    const result = buildOrganizationLd({ url: "http://localhost:3000", logoUrl: "http://localhost:3000/logo.png" });
    expect(result).not.toHaveProperty("sameAs");
  });

  it("includes sameAs when profiles are given", () => {
    const result = buildOrganizationLd({
      url: "http://localhost:3000",
      logoUrl: "http://localhost:3000/logo.png",
      sameAs: ["https://www.instagram.com/gallurio"],
    });
    expect(result.sameAs).toEqual(["https://www.instagram.com/gallurio"]);
  });
});

describe("buildWebSiteLd", () => {
  it("builds a WebSite node keyed by a stable @id off the given url", () => {
    const result = buildWebSiteLd({ url: "http://localhost:3000" });

    expect(result).toEqual({
      "@context": "https://schema.org",
      "@id": "http://localhost:3000#website",
      "@type": "WebSite",
      name: "Gallurio",
      url: "http://localhost:3000",
    });
  });
});

describe("buildCollectionPageLd", () => {
  it("builds a CollectionPage with a 1-indexed ItemList using `item`, not `url`", () => {
    const result = buildCollectionPageLd({
      url: "http://localhost:3000/compare",
      name: "Comparisons",
      description: "Gallurio vs the tools event businesses actually use.",
      items: [
        { name: "HoneyBook Alternatives 2026", url: "http://localhost:3000/compare/gallurio-vs-honeybook" },
        { name: "Dubsado Alternatives 2026", url: "http://localhost:3000/compare/gallurio-vs-dubsado" },
      ],
    });

    expect(result).toEqual({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Comparisons",
      description: "Gallurio vs the tools event businesses actually use.",
      url: "http://localhost:3000/compare",
      mainEntity: {
        "@type": "ItemList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "HoneyBook Alternatives 2026",
            item: "http://localhost:3000/compare/gallurio-vs-honeybook",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Dubsado Alternatives 2026",
            item: "http://localhost:3000/compare/gallurio-vs-dubsado",
          },
        ],
      },
    });
  });
});

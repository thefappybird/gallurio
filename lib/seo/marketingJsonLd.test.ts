import { describe, it, expect } from "vitest";
import {
  buildSoftwareApplicationLd,
  buildFaqLd,
  buildArticleLd,
  buildBreadcrumbLd,
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

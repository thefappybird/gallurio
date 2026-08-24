export type SoftwareApplicationLdInput = {
  price: number;
  currency: string;
  url: string;
};

export function buildSoftwareApplicationLd(
  input: SoftwareApplicationLdInput
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Gallurio",
    applicationCategory: "BusinessApplication",
    url: input.url,
    offers: {
      "@type": "Offer",
      price: input.price,
      priceCurrency: input.currency,
    },
  };
}

export type FaqLdItem = { question: string; answer: string };

export function buildFaqLd(items: FaqLdItem[]): Record<string, unknown> | null {
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export type ArticleLdInput = {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  updatedAt?: string;
};

export function buildArticleLd(input: ArticleLdInput): Record<string, unknown> {
  const origin = new URL(input.url).origin;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    url: input.url,
    datePublished: input.publishedAt,
    dateModified: input.updatedAt ?? input.publishedAt,
    author: {
      "@type": "Organization",
      name: "Gallurio Editorial",
      url: `${origin}/about`,
    },
    publisher: {
      "@type": "Organization",
      name: "Gallurio",
      url: origin,
    },
  };
}

export type BreadcrumbLdItem = { name: string; url: string };

export function buildBreadcrumbLd(trail: BreadcrumbLdItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

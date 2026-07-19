import { portfolioPublicUrl } from "@/lib/portfolio/publicUrl";

// ---------------------------------------------------------------------------
// businessType → schema.org @type mapping  (audit §4.1)
// ---------------------------------------------------------------------------

const BUSINESS_TYPE_SCHEMA_MAP: Record<string, string> = {
  photographer: "PhotographyBusiness",
  venue: "EventVenue",
  planner: "LocalBusiness",
  stylist: "HairSalon",
  catering: "FoodEstablishment",
  entertainer: "LocalBusiness",
  other: "LocalBusiness",
};

export function resolveSchemaType(businessType?: string): string {
  if (!businessType) return "LocalBusiness";
  return BUSINESS_TYPE_SCHEMA_MAP[businessType] ?? "LocalBusiness";
}

export type JsonLdInput = {
  name: string;
  slug: string;
  businessType?: string;
  email?: string;
  phone?: string;
  description?: string;
  image?: string;
  address?: string;
  sameAs?: string[];
  keywords?: string[];
};

function defined<T>(v: T | undefined): v is T {
  return v !== undefined && v !== null && v !== ("" as unknown);
}

export function buildHomeJsonLd(input: JsonLdInput): [Record<string, unknown>, Record<string, unknown>] {
  const homeUrl = portfolioPublicUrl(input.slug);
  const type = resolveSchemaType(input.businessType);
  const lb: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    name: input.name,
    url: homeUrl,
  };
  if (defined(input.description)) lb.description = input.description;
  if (defined(input.image)) lb.image = input.image;
  if (defined(input.phone)) lb.telephone = input.phone;
  if (defined(input.email)) lb.email = input.email;
  if (defined(input.address)) lb.address = { "@type": "PostalAddress", streetAddress: input.address };
  if (input.sameAs && input.sameAs.length > 0) lb.sameAs = input.sameAs;
  if (input.keywords && input.keywords.length > 0) lb.keywords = input.keywords.join(", ");
  const website: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    url: homeUrl,
  };
  return [lb, website];
}

export function buildGalleryJsonLd(input: JsonLdInput): [Record<string, unknown>, Record<string, unknown>] {
  const homeUrl = portfolioPublicUrl(input.slug);
  const galleryUrl = `${homeUrl}/gallery`;
  const type = resolveSchemaType(input.businessType);
  const imageGallery: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: `${input.name} — Gallery`,
    url: galleryUrl,
    author: { "@type": type, name: input.name, url: homeUrl },
  };
  const breadcrumb: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: input.name, item: homeUrl },
      { "@type": "ListItem", position: 2, name: "Gallery", item: galleryUrl },
    ],
  };
  return [imageGallery, breadcrumb];
}
export function safeJsonLd(data: unknown): string {
  // Escape every </script token regardless of what follows (>, />, space+>, etc.)
  // because HTML5 ends a <script> element on </script followed by any of:
  // >, whitespace, or / — not just the exact string </script>.
  return JSON.stringify(data).replace(/<\/script/gi, "<\\/script");
}

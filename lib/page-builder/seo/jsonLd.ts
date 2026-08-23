import { portfolioGalleryUrl, portfolioPublicUrl } from "@/lib/portfolio/publicUrl";
import type { PublishedImage } from "./publishedImages";

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
  /** Published gallery photos (excludes decorative backgroundImages) — feeds ImageGallery.image. */
  images?: PublishedImage[];
};

function defined<T>(v: T | undefined): v is T {
  return v !== undefined && v !== null && v !== ("" as unknown);
}

/**
 * business/website/webpage @ids are keyed off the HOME page's canonical URL.
 * The Gallery page's own JSON-LD (buildGalleryJsonLd) cross-references these
 * same ids via `{ "@id": ... }` instead of re-inlining the objects — standard
 * schema.org multi-page entity linking.
 */
export function buildHomeJsonLd(
  input: JsonLdInput
): [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>] {
  const homeUrl = portfolioPublicUrl(input.slug);
  const type = resolveSchemaType(input.businessType);
  const businessId = `${homeUrl}#business`;
  const websiteId = `${homeUrl}#website`;
  const webpageId = `${homeUrl}#webpage`;

  const business: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@id": businessId,
    "@type": type,
    name: input.name,
    url: homeUrl,
  };
  if (defined(input.description)) business.description = input.description;
  if (defined(input.image)) business.image = input.image;
  if (defined(input.phone)) business.telephone = input.phone;
  if (defined(input.email)) business.email = input.email;
  if (defined(input.address)) business.address = { "@type": "PostalAddress", streetAddress: input.address };
  if (input.sameAs && input.sameAs.length > 0) business.sameAs = input.sameAs;
  if (input.keywords && input.keywords.length > 0) business.keywords = input.keywords.join(", ");

  const website: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@id": websiteId,
    "@type": "WebSite",
    name: input.name,
    url: homeUrl,
    publisher: { "@id": businessId },
  };

  const webpage: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@id": webpageId,
    "@type": "WebPage",
    url: homeUrl,
    isPartOf: { "@id": websiteId },
    about: { "@id": businessId },
  };

  return [business, website, webpage];
}

export function buildGalleryJsonLd(input: JsonLdInput): [Record<string, unknown>, Record<string, unknown>] {
  const homeUrl = portfolioPublicUrl(input.slug);
  const galleryUrl = portfolioGalleryUrl(input.slug);
  const businessId = `${homeUrl}#business`;
  const websiteId = `${homeUrl}#website`;
  const galleryId = `${galleryUrl}#gallery`;
  const breadcrumbId = `${galleryUrl}#breadcrumb`;

  const imageGallery: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@id": galleryId,
    "@type": "ImageGallery",
    name: `${input.name} — Gallery`,
    url: galleryUrl,
    isPartOf: { "@id": websiteId },
    author: { "@id": businessId },
  };
  const images = (input.images ?? []).filter((img) => defined(img.url));
  if (images.length > 0) {
    imageGallery.image = images.map((img): Record<string, unknown> => {
      const obj: Record<string, unknown> = { "@type": "ImageObject", contentUrl: img.url, url: img.url };
      if (defined(img.alt)) obj.description = img.alt;
      return obj;
    });
  }

  const breadcrumb: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@id": breadcrumbId,
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

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

function buildBusinessNode(input: JsonLdInput, businessId: string, homeUrl: string): Record<string, unknown> {
  const type = resolveSchemaType(input.businessType);
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
  return business;
}

function buildWebsiteNode(
  input: JsonLdInput,
  websiteId: string,
  businessId: string,
  homeUrl: string
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@id": websiteId,
    "@type": "WebSite",
    name: input.name,
    url: homeUrl,
    publisher: { "@id": businessId },
  };
}

/**
 * business/website @ids are keyed off the HOME page's canonical URL. Both the
 * Home page (via buildHomeJsonLd) and the Gallery page call this directly so
 * the two pages emit byte-identical business/website nodes — one source of
 * truth, no drift. Each page must define every node it cross-references via
 * `{ "@id": ... }`, since `@id` linking only resolves within one document.
 */
export function buildPortfolioEntityNodes(input: JsonLdInput): [Record<string, unknown>, Record<string, unknown>] {
  const homeUrl = portfolioPublicUrl(input.slug);
  const businessId = `${homeUrl}#business`;
  const websiteId = `${homeUrl}#website`;
  const business = buildBusinessNode(input, businessId, homeUrl);
  const website = buildWebsiteNode(input, websiteId, businessId, homeUrl);
  return [business, website];
}

export function buildHomeJsonLd(
  input: JsonLdInput
): [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>] {
  const homeUrl = portfolioPublicUrl(input.slug);
  const websiteId = `${homeUrl}#website`;
  const businessId = `${homeUrl}#business`;
  const webpageId = `${homeUrl}#webpage`;
  const [business, website] = buildPortfolioEntityNodes(input);

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

/**
 * Maps a workspace document to the shared entity-level JsonLdInput fields.
 * Home and Gallery pages both call this so business/website field mapping
 * (sameAs, description, image, ...) can never drift between the two pages.
 * Page-specific fields (Gallery's `images`) are merged in by the caller.
 */
export function buildPortfolioJsonLdInput(workspace: {
  name: string;
  slug: string;
  businessType?: string | null;
  contact?: {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    socials?: {
      instagram?: string | null;
      facebook?: string | null;
      tiktok?: string | null;
      website?: string | null;
    } | null;
  } | null;
  publicPage?: {
    seoDescription?: string | null;
    seo?: unknown;
    siteIcon?: { url?: string | null } | null;
  } | null;
}): Omit<JsonLdInput, "images"> {
  const socials = workspace.contact?.socials;
  const sameAs: string[] = [];
  if (socials?.instagram) sameAs.push(`https://www.instagram.com/${socials.instagram}`);
  if (socials?.facebook) sameAs.push(`https://www.facebook.com/${socials.facebook}`);
  if (socials?.tiktok) sameAs.push(`https://www.tiktok.com/@${socials.tiktok}`);
  if (socials?.website) sameAs.push(socials.website);

  const seo = workspace.publicPage?.seo as { ogImageUrl?: string; keywords?: string[] } | undefined;

  return {
    name: workspace.name,
    slug: workspace.slug,
    businessType: workspace.businessType || undefined,
    description: workspace.publicPage?.seoDescription || undefined,
    image: seo?.ogImageUrl || workspace.publicPage?.siteIcon?.url || undefined,
    email: workspace.contact?.email || undefined,
    phone: workspace.contact?.phone || undefined,
    address: workspace.contact?.address || undefined,
    sameAs,
    keywords: seo?.keywords,
  };
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

import type { MetadataRoute } from "next";
import { listPublishedWorkspaceSlugs } from "@/lib/db/queries/publicPage";
import { listEntries } from "@/lib/content/entries";
import { portfolioGalleryUrl, portfolioPublicUrl } from "@/lib/portfolio/publicUrl";

// Node runtime: connects to MongoDB (Edge runtime cannot use Mongoose).
export const runtime = "nodejs";
// Re-fetch on every request: published workspaces change at publish time.
export const dynamic = "force-dynamic";

// Marketing routes are static and known at build time, so they are listed
// here rather than discovered. Only the English (unprefixed) URL is listed:
// the localized variants are declared through hreflang on each page, and
// listing all five here would submit five near-duplicates of one page.
const MARKETING_PATHS = [
  "/",
  "/pricing",
  "/about",
  "/contact",
  "/book-demo",
  "/compare",
  "/blog",
  "/resources",
  "/privacy",
  "/terms",
  "/refunds",
];

function marketingEntries(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const pages = MARKETING_PATHS.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: "monthly" as const,
    priority: path === "/" || path === "/pricing" ? 1 : 0.9,
  }));

  const compare = listEntries("compare").map((entry) => ({
    url: `${base}/compare/${entry.slug}`,
    lastModified: new Date(entry.updatedAt ?? entry.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.9,
  }));

  const blog = listEntries("blog").map((entry) => ({
    url: `${base}/blog/${entry.slug}`,
    lastModified: new Date(entry.updatedAt ?? entry.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...pages, ...compare, ...blog];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const workspaces = await listPublishedWorkspaceSlugs();

  const tenants = workspaces.flatMap(({ slug, lastPublishedAt }) => {
    const homeUrl = portfolioPublicUrl(slug);
    const galleryUrl = portfolioGalleryUrl(slug);
    // Omit lastModified entirely when the timestamp is absent rather than
    // emitting `undefined`, which some serialisers coerce to null.
    const lastModified = lastPublishedAt ?? undefined;

    return [
      {
        url: homeUrl,
        ...(lastModified !== undefined && { lastModified }),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
      {
        url: galleryUrl,
        ...(lastModified !== undefined && { lastModified }),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      },
    ];
  });

  return [...marketingEntries(), ...tenants];
}

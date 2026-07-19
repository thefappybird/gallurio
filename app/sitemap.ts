import type { MetadataRoute } from "next";
import { listPublishedWorkspaceSlugs } from "@/lib/db/queries/publicPage";
import { portfolioPublicUrl } from "@/lib/portfolio/publicUrl";

// Node runtime: connects to MongoDB (Edge runtime cannot use Mongoose).
export const runtime = "nodejs";
// Re-fetch on every request: published workspaces change at publish time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const workspaces = await listPublishedWorkspaceSlugs();

  return workspaces.flatMap(({ slug, lastPublishedAt }) => {
    const homeUrl = portfolioPublicUrl(slug);
    const galleryUrl = `${homeUrl}/gallery`;
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
}

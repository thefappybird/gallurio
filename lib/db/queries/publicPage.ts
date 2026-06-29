import { cache } from "react";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models/Workspace";

/**
 * Resolves a public portfolio page by workspace slug.
 *
 * Returns null when:
 * - the slug is empty or whitespace
 * - no workspace with that slug exists
 * - the workspace has not been published (`publicPage.publishedAt === null`)
 *
 * Multi-tenant safety: slug is the only identifier — no client-supplied
 * workspaceId is trusted. The slug is stored lowercase (Mongoose `lowercase: true`),
 * so we normalise the input before querying.
 *
 * Wrapped in React `cache()` so the three call sites (generateMetadata, layout,
 * page) that run within the same request dedup to a single DB round-trip.
 * Persistent cross-request caching (cacheTag/unstable_cache) is intentionally
 * deferred until the Phase 9 publish action exists to invalidate it — without
 * an invalidation counterpart, a persistent cache would serve stale pages.
 */
/**
 * Slim slug -> {_id, timezone} resolver for the public page-view beacon: avoids
 * pulling the heavy publicPage subtree on every hit. Published-only, lowercased
 * slug; never trusts a client-supplied workspaceId.
 */
export const resolveWorkspaceIdBySlug = cache(
  async (
    slug: string
  ): Promise<{ _id: import("mongoose").Types.ObjectId; timezone: string | null } | null> => {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) return null;
    await connectDB();
    const ws = await Workspace.findOne({
      slug: normalized,
      "publicPage.publishedAt": { $ne: null },
    })
      .select({ _id: 1, timezone: 1 })
      .lean<{ _id: import("mongoose").Types.ObjectId; timezone?: string | null }>();
    if (!ws) return null;
    return { _id: ws._id, timezone: ws.timezone ?? null };
  }
);

export const findPublishedWorkspaceBySlug = cache(async (slug: string) => {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  await connectDB();

  const workspace = await Workspace.findOne({
    slug: normalized,
    "publicPage.publishedAt": { $ne: null },
  })
    .select("slug name country publicPage contact")
    .lean();

  return workspace ?? null;
});

export type PublishedWorkspaceSlug = {
  slug: string;
  lastPublishedAt: Date | null;
};

/**
 * Returns slug + lastPublishedAt for every workspace whose portfolio has been
 * published at least once. Used by app/sitemap.ts to build the global sitemap.
 *
 * No tenant scoping: this is a public list of published pages, intentionally
 * cross-workspace.
 *
 * Index note: the query filters on `publicPage.publishedAt` which is currently
 * backed only by the `slug` unique index (collection scan for this predicate).
 * For MVP tenant counts this is acceptable. If tenant count grows, add a sparse
 * index on `{ "publicPage.publishedAt": 1 }` and split output into sitemap
 * index files via Next.js `generateSitemaps` + `id` param.
 *
 * ponytail: if tenant count exceeds ~50k this must paginate via sitemap index
 * files (Next.js `generateSitemaps` + `id` param on the default export).
 */
export async function listPublishedWorkspaceSlugs(): Promise<PublishedWorkspaceSlug[]> {
  await connectDB();

  type SlugProjection = {
    slug: string;
    publicPage: { lastPublishedAt?: Date | null };
  };

  const docs = await Workspace.find({ "publicPage.publishedAt": { $ne: null } })
    .select({ slug: 1, "publicPage.lastPublishedAt": 1, _id: 0 })
    .lean<SlugProjection[]>();

  return docs.map((d) => ({
    slug: d.slug,
    lastPublishedAt: d.publicPage?.lastPublishedAt ?? null,
  }));
}

import { cache } from "react";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models/Workspace";
import { PreviewSnapshot } from "@/lib/db/models/PreviewSnapshot";

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

/**
 * Looks up a short-lived preview snapshot by its opaque token.
 * Snapshots expire automatically via MongoDB TTL (2 hours).
 * Returns null for unknown or expired tokens — callers fall back to published data.
 */
export async function findPreviewSnapshot(token: string, workspaceId: string) {
  if (!token || !workspaceId) return null;
  await connectDB();
  return PreviewSnapshot.findOne({ token, workspaceId }).lean();
}

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
 */
export async function findPublishedWorkspaceBySlug(slug: string) {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  await connectDB();

  const workspace = await Workspace.findOne({
    slug: normalized,
    "publicPage.publishedAt": { $ne: null },
  }).lean();

  return workspace ?? null;
}

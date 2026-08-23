import { cache } from "react";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models/Workspace";
import { User } from "@/lib/db/models/User";
import { DEFAULT_TIME_MODE, type TimeMode } from "@/lib/utils/time-format";

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

/**
 * Slim slug -> ownerUserId resolver, kept separate from
 * `findPublishedWorkspaceBySlug` (which deliberately strips ownerUserId from
 * its projection before that doc reaches render/prop-serialization paths).
 */
export const resolveWorkspaceOwnerBySlug = cache(async (slug: string): Promise<string | null> => {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  await connectDB();
  const ws = await Workspace.findOne({
    slug: normalized,
    "publicPage.publishedAt": { $ne: null },
  })
    .select({ ownerUserId: 1 })
    .lean<{ ownerUserId?: string }>();
  return ws?.ownerUserId ?? null;
});

/**
 * Resolves the workspace owner's saved time-format preference, so public
 * date/time inputs (e.g. the contact form) match the hour cycle the owner
 * already sees on their own calendar candles. Falls back to the app default
 * when the owner record is missing.
 */
export const getOwnerTimeFormat = cache(async (ownerUserId: string): Promise<TimeMode> => {
  await connectDB();
  const owner = await User.findOne({ workosUserId: ownerUserId })
    .select("timeFormat")
    .lean<{ timeFormat?: TimeMode }>();
  return owner?.timeFormat ?? DEFAULT_TIME_MODE;
});

export type PublishedWorkspaceSlug = {
  slug: string;
  lastPublishedAt: Date | null;
  hasHome: boolean;
  hasGallery: boolean;
};

/**
 * Returns slug + lastPublishedAt + per-page renderability for every workspace
 * whose portfolio has been published at least once and isn't crawler-excluded.
 * Used by app/sitemap.ts to build the global sitemap.
 *
 * `"publicPage.seo.noindex": { $ne: true }` also matches documents with no
 * `seo` subdoc at all (pre-existing workspaces default to indexable).
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
/**
 * Aggregation-expression mirror of `hasRenderableBlocks`
 * (lib/page-builder/normalizePublicPageData.ts) — computes the same boolean
 * server-side so this query never pulls the (potentially huge, per-tenant)
 * Puck `data` blob across the wire just to answer a yes/no question.
 *
 * Must stay in lockstep with the predicate:
 *   isPlainObject(raw) && (content.length > 0 || hasZoneContent(zones))
 * where content/zones default to [] / undefined when absent or the wrong
 * shape. No per-entry validation — a malformed entry (e.g. `null`) still
 * counts, exactly like the JS predicate (it only checks array length).
 *
 * Parity with `hasRenderableBlocks` is enforced by a shared-fixture test in
 * publicPage.sitemap.test.ts; if this ever drifts, the sitemap silently
 * advertises URLs that render "Coming Soon".
 */
function renderableBlocksAggExpr(fieldPath: string) {
  return {
    $let: {
      vars: {
        // BSON $type distinguishes "object" (embedded doc) from "array",
        // "null", and "missing" — the same object/array/nullish split
        // `isPlainObject` makes in JS.
        isObj: { $eq: [{ $type: `$${fieldPath}` }, "object"] },
        contentArr: {
          $cond: [{ $isArray: `$${fieldPath}.content` }, `$${fieldPath}.content`, []],
        },
        zonesObj: {
          $cond: [{ $eq: [{ $type: `$${fieldPath}.zones` }, "object"] }, `$${fieldPath}.zones`, {}],
        },
      },
      in: {
        $and: [
          "$$isObj",
          {
            $or: [
              { $gt: [{ $size: "$$contentArr" }, 0] },
              {
                $anyElementTrue: {
                  $map: {
                    input: { $objectToArray: "$$zonesObj" },
                    as: "z",
                    in: {
                      $cond: [{ $isArray: "$$z.v" }, { $gt: [{ $size: "$$z.v" }, 0] }, false],
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    },
  };
}

export async function listPublishedWorkspaceSlugs(): Promise<PublishedWorkspaceSlug[]> {
  await connectDB();

  // Aggregation, not find()+lean(): the $project below computes hasHome/
  // hasGallery server-side so no tenant's Puck `data` blob (home + gallery
  // trees, tens-to-hundreds of KB each) crosses the wire or gets hydrated
  // into a Mongoose document — only 4 scalar fields per tenant leave Mongo.
  const cursor = Workspace.aggregate<PublishedWorkspaceSlug>([
    {
      $match: {
        "publicPage.publishedAt": { $ne: null },
        "publicPage.seo.noindex": { $ne: true },
      },
    },
    {
      $project: {
        _id: 0,
        slug: 1,
        lastPublishedAt: { $ifNull: ["$publicPage.lastPublishedAt", null] },
        hasHome: renderableBlocksAggExpr("publicPage.data.home"),
        hasGallery: renderableBlocksAggExpr("publicPage.data.gallery"),
      },
    },
  ]).cursor();

  // Cursor-iterate rather than materialize the whole result set: tenant count
  // is unbounded and this list only grows with the platform.
  const results: PublishedWorkspaceSlug[] = [];
  for await (const doc of cursor) {
    results.push(doc);
  }
  return results;
}

import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models/Workspace";
import { GalleryItem } from "@/lib/db/models/GalleryItem";
import { GalleryCollection } from "@/lib/db/models/GalleryCollection";
import { collectBlocks } from "@/lib/page-builder/blockTree";
import { imageDeliveryUrl } from "@/lib/storage/cloudflareImages";
import type { PuckData } from "@/lib/page-builder/types";
import { entitledMatch } from "@/lib/discover/entitledMatch";
import { renderableBlocksAggExpr } from "@/lib/db/queries/publicPage";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import { resolveEffectiveFonts, type PortfolioFontSelection } from "@/lib/page-builder/fonts";
import { DEFAULT_BRAND_KIT, type PortfolioBrandKit } from "@/lib/page-builder/types";
import type { BUSINESS_TYPE_VALUES } from "@/lib/validators/workspace";

/**
 * Public Discover directory reads.
 *
 * Tenancy exception: these queries are intentionally cross-workspace (a public
 * directory of opted-in portfolios), like `listPublishedWorkspaceSlugs`. The
 * `$project` below is an absolute whitelist: never add `contact`,
 * `ownerUserId`, `inquiryRecipientEmail`, `publicPage.data` or anything a
 * `hideClient` item could leak.
 */

export type BusinessType = (typeof BUSINESS_TYPE_VALUES)[number];

export type DiscoverCard = {
  slug: string;
  name: string;
  category: BusinessType | null;
  country: string | null;
  pitch: string;
  cover: { url: string; width: number; height: number } | null;
  brand: { bg: string; fg: string; accent: string; headingFont: PortfolioFontSelection };
};

type BrandKitRow = Partial<
  Pick<
    PortfolioBrandKit,
    | "themePreset"
    | "fontPair"
    | "headingFont"
    | "backgroundColor"
    | "foregroundColor"
    | "accentColor"
    | "primaryColor"
  >
>;

type ListedRow = {
  _id: unknown;
  slug: string;
  name: string;
  businessType?: BusinessType;
  country?: string | null;
  discover?: {
    listedAt?: Date | null;
    coverUrl?: string;
    coverWidth?: number | null;
    coverHeight?: number | null;
  };
  publicPage?: {
    seoDescription?: string;
    seo?: { ogImageUrl?: string };
    brandKit?: BrandKitRow;
  };
};

// Absolute whitelist (see module note). Everything the cards need, nothing else.
const CARD_PROJECTION = {
  slug: 1,
  name: 1,
  businessType: 1,
  country: 1,
  "discover.listedAt": 1,
  "discover.coverUrl": 1,
  "discover.coverWidth": 1,
  "discover.coverHeight": 1,
  "publicPage.seoDescription": 1,
  "publicPage.seo.ogImageUrl": 1,
  "publicPage.brandKit.themePreset": 1,
  "publicPage.brandKit.fontPair": 1,
  "publicPage.brandKit.headingFont": 1,
  "publicPage.brandKit.backgroundColor": 1,
  "publicPage.brandKit.foregroundColor": 1,
  "publicPage.brandKit.accentColor": 1,
  "publicPage.brandKit.primaryColor": 1,
} as const;

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;

function clampLimit(limit: number | undefined): number {
  const n = Number.isFinite(limit) ? Math.trunc(limit as number) : DEFAULT_LIMIT;
  return Math.min(Math.max(1, n), MAX_LIMIT);
}

// Opaque cursor = base64url of "<listedAt ISO>|<_id>" (empty ISO = no listedAt).
// Local copy of the pattern in gallery.ts / notifications.ts (see REUSABLE_CODE.md).
function encodeCursor(listedAt: Date | null | undefined, id: string): string {
  return Buffer.from(`${listedAt ? listedAt.toISOString() : ""}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { listedAt: Date | null; id: Types.ObjectId } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!id || !Types.ObjectId.isValid(id)) return null;
    const listedAt = iso ? new Date(iso) : null;
    if (listedAt && Number.isNaN(listedAt.getTime())) return null;
    return { listedAt, id: new Types.ObjectId(id) };
  } catch {
    return null;
  }
}

// Shared by the list and the detail so a workspace is visible in one iff the other.
function listedMatch(now: Date) {
  return {
    "discover.listed": true,
    "publicPage.publishedAt": { $ne: null },
    "publicPage.seo.noindex": { $ne: true },
    ...entitledMatch(now),
  };
}

const MAX_QUERY_LENGTH = 60;

// Trimmed, capped, regex-escaped case-insensitive name match; no filter when empty.
function nameMatch(q: string | undefined) {
  const term = q?.trim().slice(0, MAX_QUERY_LENGTH) ?? "";
  if (!term) return {};
  return { name: { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } };
}

// Keyset condition for "listedAt desc, _id desc". Its own `$or`, so it is wrapped in
// `$and` to avoid colliding with the entitlement `$or` in `listedMatch`.
function cursorMatch(cursor: string | null | undefined) {
  const decoded = cursor ? decodeCursor(cursor) : null;
  if (!decoded) return {};
  return {
    $and: [
      {
        $or: [
          ...(decoded.listedAt ? [{ "discover.listedAt": { $lt: decoded.listedAt } }] : []),
          { "discover.listedAt": decoded.listedAt, _id: { $lt: decoded.id } },
        ],
      },
    ],
  };
}

// Same resolution the public page applies (resolveBrandKit / resolveEffectiveFonts).
// Lean docs carry no schema defaults, so empty colors fall back to DEFAULT_BRAND_KIT,
// exactly like the page's `brandKit ?? DEFAULT_BRAND_KIT`; fonts keep the legacy
// `fontPair` fallback inside resolveEffectiveFonts.
function resolveCardBrand(stored: BrandKitRow = {}): DiscoverCard["brand"] {
  const merged: PortfolioBrandKit = { ...DEFAULT_BRAND_KIT };
  for (const key of ["themePreset", "backgroundColor", "foregroundColor", "accentColor", "primaryColor"] as const) {
    const value = stored[key];
    if (value) (merged as Record<string, unknown>)[key] = value;
  }
  const { cssVars } = resolveBrandKit(merged);
  const { headingFont } = resolveEffectiveFonts({ fontPair: stored.fontPair, headingFont: stored.headingFont });
  return {
    bg: cssVars["--pf-color-bg"],
    fg: cssVars["--pf-color-fg"],
    accent: cssVars["--pf-color-accent"],
    headingFont,
  };
}

function resolveCover(row: ListedRow): DiscoverCard["cover"] {
  const og = row.publicPage?.seo?.ogImageUrl;
  if (og) return { url: og, width: 1200, height: 630 };
  const url = row.discover?.coverUrl;
  if (!url) return null;
  const { coverWidth, coverHeight } = row.discover ?? {};
  return coverWidth && coverHeight
    ? { url, width: coverWidth, height: coverHeight }
    : { url, width: 4, height: 5 };
}

function toCard(row: ListedRow): DiscoverCard {
  return {
    slug: row.slug,
    name: row.name,
    category: row.businessType && row.businessType !== "other" ? row.businessType : null,
    country: row.country ?? null,
    pitch: row.publicPage?.seoDescription ?? "",
    cover: resolveCover(row),
    brand: resolveCardBrand(row.publicPage?.brandKit),
  };
}

export async function listDiscoverPortfolios(
  opts: { cursor?: string | null; category?: BusinessType; q?: string; limit?: number; now?: Date } = {}
): Promise<{
  items: DiscoverCard[];
  nextCursor: string | null;
}> {
  await connectDB();
  const now = opts.now ?? new Date();
  const limit = clampLimit(opts.limit);

  const rows = await Workspace.aggregate<ListedRow>([
    {
      $match: {
        ...listedMatch(now),
        ...(opts.category ? { businessType: opts.category } : {}),
        ...nameMatch(opts.q),
        ...cursorMatch(opts.cursor),
      },
    },
    { $addFields: { hasHome: renderableBlocksAggExpr("publicPage.data.home") } },
    { $match: { hasHome: true } },
    { $sort: { "discover.listedAt": -1, _id: -1 } },
    { $limit: limit + 1 },
    { $project: CARD_PROJECTION },
  ]);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor = rows.length > limit && last ? encodeCursor(last.discover?.listedAt, String(last._id)) : null;
  return { items: page.map(toCard), nextCursor };
}

export type DiscoverDetail = DiscoverCard & {
  images: { url: string; width: number; height: number; alt: string }[];
};

const MAX_DETAIL_IMAGES = 5;
// Bounds the candidate refs / collection items we resolve; only 5 images are shown.
const MAX_REFS = 25;
const MAX_COLLECTION_ITEMS = 200;

type Ref = { kind: "asset"; publicId: string } | { kind: "collection"; id: string };
type ImageRef = { id?: unknown; publicId?: unknown };

// Published image / collection references in render order (home, then gallery).
// Reads only ids out of the Puck tree; the tree itself never leaves this module.
function collectRefs(pages: Array<PuckData | null | undefined>): Ref[] {
  const refs: Ref[] = [];
  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    for (const block of collectBlocks(page)) {
      for (const key of ["images", "backgroundImages"]) {
        const imgs = block.props?.[key];
        if (!Array.isArray(imgs)) continue;
        for (const img of imgs as ImageRef[]) {
          if (img && typeof img.publicId === "string" && img.publicId) {
            refs.push({ kind: "asset", publicId: img.publicId });
          }
        }
      }
      const cols =
        block.type === "FeaturedWork"
          ? block.props?.collections
          : block.type === "CollectionCard"
            ? [block.props?.collection]
            : null;
      if (!Array.isArray(cols)) continue;
      for (const col of cols as Array<{ id?: unknown } | undefined>) {
        if (col && typeof col.id === "string" && Types.ObjectId.isValid(col.id)) {
          refs.push({ kind: "collection", id: col.id });
        }
      }
    }
  }
  return refs.slice(0, MAX_REFS);
}

type ItemRow = {
  assetId: string;
  collectionId?: unknown;
  width?: number | null;
  height?: number | null;
  caption?: string;
  altText?: string;
};

const ITEM_FIELDS = { assetId: 1, collectionId: 1, width: 1, height: 1, caption: 1, altText: 1 } as const;

export async function getDiscoverPortfolio(slug: string, now: Date = new Date()): Promise<DiscoverDetail | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  await connectDB();

  // Query 1: the workspace. `publicPage.data` is projected ONLY to pull ids out of it.
  const [row] = await Workspace.aggregate<
    ListedRow & { publicPage?: { data?: { home?: PuckData | null; gallery?: PuckData | null } } }
  >([
    { $match: { ...listedMatch(now), slug: normalized } },
    { $addFields: { hasHome: renderableBlocksAggExpr("publicPage.data.home") } },
    { $match: { hasHome: true } },
    { $limit: 1 },
    { $project: { ...CARD_PROJECTION, "publicPage.data.home": 1, "publicPage.data.gallery": 1 } },
  ]);
  if (!row) return null;

  const workspaceId = row._id;
  const refs = collectRefs([row.publicPage?.data?.home, row.publicPage?.data?.gallery]);
  const assetIds = [...new Set(refs.flatMap((r) => (r.kind === "asset" ? [r.publicId] : [])))];
  const collectionIds = [...new Set(refs.flatMap((r) => (r.kind === "collection" ? [r.id] : [])))];

  // A published snapshot keeps its collection refs after the owner makes a
  // collection private, so only public collections may contribute photos (same
  // boundary as the public popup and the SEO/sitemap collectors).
  const publicCollectionIds = collectionIds.length
    ? (
        await GalleryCollection.find({ workspaceId, _id: { $in: collectionIds }, isPublic: true })
          .select({ _id: 1 })
          .lean<Array<{ _id: Types.ObjectId }>>()
      ).map((c) => String(c._id))
    : [];

  // Item queries, both scoped by workspaceId: a ref to another workspace's asset or
  // collection resolves to nothing and is dropped.
  const [byAsset, byCollection] = await Promise.all([
    assetIds.length
      ? GalleryItem.find({ workspaceId, assetId: { $in: assetIds } })
          .select(ITEM_FIELDS)
          .lean<ItemRow[]>()
      : Promise.resolve([] as ItemRow[]),
    publicCollectionIds.length
      ? GalleryItem.find({ workspaceId, collectionId: { $in: publicCollectionIds } })
          .sort({ order: 1, _id: 1 })
          .limit(MAX_COLLECTION_ITEMS)
          .select(ITEM_FIELDS)
          .lean<ItemRow[]>()
      : Promise.resolve([] as ItemRow[]),
  ]);

  const assetMap = new Map<string, ItemRow>();
  for (const it of [...byAsset, ...byCollection]) if (!assetMap.has(it.assetId)) assetMap.set(it.assetId, it);
  const itemsByCollection = new Map<string, ItemRow[]>();
  for (const it of byCollection) {
    const key = String(it.collectionId);
    itemsByCollection.set(key, [...(itemsByCollection.get(key) ?? []), it]);
  }

  const images: DiscoverDetail["images"] = [];
  const seen = new Set<string>();
  const og = row.publicPage?.seo?.ogImageUrl;
  if (og) images.push({ url: og, width: 1200, height: 630, alt: "" });

  const push = (publicId: string, it: ItemRow | undefined) => {
    if (!it || seen.has(publicId) || images.length >= MAX_DETAIL_IMAGES) return;
    seen.add(publicId);
    images.push({
      url: imageDeliveryUrl(publicId, { width: 1600, fit: "scale-down" }),
      width: it.width || 4,
      height: it.height || 3,
      alt: it.caption || it.altText || "",
    });
  };
  for (const ref of refs) {
    if (ref.kind === "asset") push(ref.publicId, assetMap.get(ref.publicId));
    else for (const it of itemsByCollection.get(ref.id) ?? []) push(it.assetId, it);
  }

  return { ...toCard(row), images };
}

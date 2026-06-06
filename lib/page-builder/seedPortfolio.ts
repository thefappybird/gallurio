import "server-only";

import { connectDB } from "@/lib/db/mongoose";
import { Workspace, GalleryCollection, GalleryItem } from "@/lib/db/models";
import {
  getTemplate,
  getTemplateForBusinessType,
  type PortfolioTemplate,
} from "@/lib/page-builder/templates";
import type { PortfolioBrandKit, PortfolioContactConfig, PortfolioPuckData, PuckData } from "@/lib/page-builder/types";
import type { Types } from "mongoose";

const FEATURED_COLLECTION_SLUG = "featured-work";

export type PortfolioSeed = {
  templateId: string;
  data: PortfolioPuckData;
  brandKit: PortfolioBrandKit;
  contact: PortfolioContactConfig;
};

/**
 * Fill any seeded gallery block's empty collectionId with a real collection, and
 * seed FeaturedWork.itemIds with the first uploaded photos, so a freshly seeded
 * portfolio isn't visibly empty when the workspace already has a Featured-work
 * collection. Mutates `data` in place.
 *
 * FeaturedWork.itemIds rows are `{ id }` objects — the shape the Puck array
 * editor round-trips (see FeaturedWorkBlock); the renderer accepts both shapes.
 */
export function injectGalleryRefs(
  data: PortfolioPuckData,
  collectionId: string,
  itemIds: string[]
): void {
  const zones: (PuckData | null)[] = [data.home, data.gallery];
  for (const z of zones) {
    if (!z) continue;
    for (const block of z.content) {
      if (block.type.startsWith("Gallery") && block.props.collectionId === "") {
        block.props.collectionId = collectionId;
      }
      if (
        block.type === "FeaturedWork" &&
        Array.isArray(block.props.itemIds) &&
        block.props.itemIds.length === 0
      ) {
        block.props.itemIds = itemIds.slice(0, 3).map((id) => ({ id }));
      }
    }
  }
}

// Build a template's seed data and wire in the workspace's existing
// "featured-work" collection (and its first photos) when one exists.
async function buildSeed(
  template: PortfolioTemplate,
  workspaceId: Types.ObjectId,
  ctx: { name: string; branding?: { tagline?: string | null; description?: string | null } | null }
): Promise<PortfolioSeed> {
  const data = template.seedData({ workspace: { name: ctx.name, branding: ctx.branding ?? null } });

  const collection = await GalleryCollection.findOne({ workspaceId, slug: FEATURED_COLLECTION_SLUG })
    .select({ _id: 1 })
    .lean();
  if (collection) {
    const items = await GalleryItem.find({ workspaceId, collectionId: collection._id })
      .sort({ order: 1, _id: 1 })
      .limit(3)
      .select({ _id: 1 })
      .lean();
    injectGalleryRefs(data, String(collection._id), items.map((i) => String(i._id)));
  }

  return {
    templateId: template.id,
    data,
    brandKit: template.defaultBrandKit,
    contact: template.defaultContact,
  };
}

/**
 * First-visit seed. Idempotent: only writes when `publicPage.data.home` is still
 * empty, so concurrent first loads can't double-seed. Returns the seed when it
 * (or a just-completed peer) populates the page, or null when already seeded by
 * a non-default flow (the caller then renders the persisted data).
 *
 * Picks the closest template for the workspace's businessType.
 */
export async function seedDefaultPortfolio(workspaceId: Types.ObjectId): Promise<PortfolioSeed | null> {
  await connectDB();
  const ws = await Workspace.findById(workspaceId)
    .select({ name: 1, branding: 1, businessType: 1, "publicPage.data.home": 1 })
    .lean();
  if (!ws) return null;
  if (ws.publicPage?.data?.home) return null; // already seeded

  const template = getTemplateForBusinessType(ws.businessType);
  const seed = await buildSeed(template, workspaceId, {
    name: ws.name,
    branding: ws.branding,
  });

  // Idempotent guard: the filter only matches while home is still empty, so a
  // racing first-load that already seeded leaves this a no-op.
  const res = await Workspace.updateOne(
    { _id: workspaceId, "publicPage.data.home": null },
    {
      $set: {
        "publicPage.templateId": seed.templateId,
        "publicPage.data": seed.data,
        "publicPage.brandKit": seed.brandKit,
        "publicPage.contact": seed.contact,
      },
    }
  );

  // We lost the race — another first-load already seeded. Return what was
  // actually persisted so the caller renders the live data, not our throwaway.
  if (res.matchedCount === 0) {
    const fresh = await Workspace.findById(workspaceId)
      .select({ "publicPage.templateId": 1, "publicPage.data": 1, "publicPage.brandKit": 1, "publicPage.contact": 1 })
      .lean();
    if (fresh?.publicPage?.data?.home) {
      return {
        templateId: fresh.publicPage.templateId ?? seed.templateId,
        data: fresh.publicPage.data as PortfolioPuckData,
        brandKit: (fresh.publicPage.brandKit as PortfolioSeed["brandKit"]) ?? seed.brandKit,
        contact: (fresh.publicPage.contact as PortfolioSeed["contact"]) ?? seed.contact,
      };
    }
  }

  return seed;
}

/**
 * Re-seed both zones from a chosen template (the in-editor template switcher).
 * Archives the current data into `previousData` first so an accidental switch is
 * recoverable. Brand kit + contact are reset to the template defaults. Returns
 * the seed, or null when the template id or workspace is unknown.
 */
export async function reseedPortfolioFromTemplate(
  workspaceId: Types.ObjectId,
  templateId: string
): Promise<PortfolioSeed | null> {
  const template = getTemplate(templateId);
  if (!template) return null;

  await connectDB();
  const ws = await Workspace.findById(workspaceId)
    .select({ name: 1, branding: 1, "publicPage.data": 1 })
    .lean();
  if (!ws) return null;

  const seed = await buildSeed(template, workspaceId, {
    name: ws.name,
    branding: ws.branding,
  });

  const set: Record<string, unknown> = {
    "publicPage.templateId": seed.templateId,
    "publicPage.data": seed.data,
    "publicPage.brandKit": seed.brandKit,
    "publicPage.contact": seed.contact,
  };
  if (ws.publicPage?.data?.home) {
    set["publicPage.previousData"] = ws.publicPage.data;
  }

  await Workspace.updateOne({ _id: workspaceId }, { $set: set });
  return seed;
}

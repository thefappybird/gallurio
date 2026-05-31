"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, GalleryCollection, GalleryItem } from "@/lib/db/models";
import { getTemplate } from "@/lib/page-builder/templates";
import { brandKitSchema, portfolioContactConfigSchema } from "@/lib/validators/publicPage";
import { PORTFOLIO_TEMPLATE_IDS } from "@/lib/page-builder/templates/types";
import type { PortfolioPuckData, PuckData } from "@/lib/page-builder/types";

const FEATURED_COLLECTION_SLUG = "featured-work";
const FEATURED_COLLECTION_NAME = "Featured work";

const starterImageSchema = z.object({
  cloudinaryPublicId: z.string().min(1).max(300),
  url: z.string().url().max(1000),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  format: z.string().max(20).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  altText: z.string().max(300).optional(),
});

const brandingSchema = z
  .object({
    logoUrl: z.string().url().max(1000).optional().or(z.literal("")),
    logoCloudinaryPublicId: z.string().max(300).optional().or(z.literal("")),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    tagline: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
  })
  .optional();

const saveWizardSchema = z.object({
  templateId: z.enum(PORTFOLIO_TEMPLATE_IDS),
  brandKit: brandKitSchema,
  contact: portfolioContactConfigSchema.optional(),
  branding: brandingSchema,
  starterImages: z.array(starterImageSchema).max(50).default([]),
});

export type SaveWizardInput = z.input<typeof saveWizardSchema>;
export type WizardActionResult = { ok: true } | { error: string };

// Fill any seeded gallery block's empty collectionId with the real collection,
// and seed FeaturedWork.itemIds with the first few uploaded images so a fresh
// portfolio isn't visibly empty. Mutates the provided data in place.
function injectGalleryRefs(
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
      if (block.type === "FeaturedWork" && Array.isArray(block.props.itemIds) && block.props.itemIds.length === 0) {
        block.props.itemIds = itemIds.slice(0, 3);
      }
    }
  }
}

export async function saveWizardOutputAction(
  input: SaveWizardInput
): Promise<WizardActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = saveWizardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "invalid_input" };
  }
  const { templateId, brandKit, contact, branding, starterImages } = parsed.data;

  const template = getTemplate(templateId);
  if (!template) return { error: "unknown_template" };

  await connectDB();
  const workspaceId = ctx.workspace._id;

  // Re-read the workspace fresh (requireOrg's is lean) to seed copy from current
  // branding, and to know whether to archive existing portfolio data.
  const workspace = await Workspace.findById(workspaceId)
    .select({ name: 1, branding: 1, "publicPage.data": 1, "publicPage.publishedAt": 1 })
    .lean();
  if (!workspace) return { error: "not_found" };

  const mergedBranding = {
    tagline: branding?.tagline ?? workspace.branding?.tagline ?? "",
    description: branding?.description ?? workspace.branding?.description ?? "",
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 1. Branding updates (only the fields the wizard collected).
      if (branding) {
        const set: Record<string, unknown> = {};
        if (branding.logoUrl) set["branding.logoUrl"] = branding.logoUrl;
        if (branding.logoCloudinaryPublicId) {
          set["branding.logoCloudinaryPublicId"] = branding.logoCloudinaryPublicId;
        }
        if (branding.primaryColor) set["branding.primaryColor"] = branding.primaryColor;
        if (branding.secondaryColor) set["branding.secondaryColor"] = branding.secondaryColor;
        if (branding.tagline !== undefined) set["branding.tagline"] = branding.tagline;
        if (branding.description !== undefined) set["branding.description"] = branding.description;
        if (Object.keys(set).length > 0) {
          await Workspace.updateOne({ _id: workspaceId }, { $set: set }, { session });
        }
      }

      // 2. Match-or-create the "Featured work" collection (one per workspace).
      let collection = await GalleryCollection.findOne(
        { workspaceId, slug: FEATURED_COLLECTION_SLUG },
        null,
        { session }
      );
      if (!collection) {
        const [created] = await GalleryCollection.create(
          [{ workspaceId, name: FEATURED_COLLECTION_NAME, slug: FEATURED_COLLECTION_SLUG, isPublic: true, order: 0 }],
          { session }
        );
        collection = created;
      }

      // 3. Insert the starter images into the collection (appended in order).
      const itemIds: string[] = [];
      if (starterImages.length > 0) {
        const existingCount = await GalleryItem.countDocuments(
          { workspaceId, collectionId: collection._id },
          { session }
        );
        const docs = starterImages.map((img, i) => ({
          workspaceId,
          collectionId: collection!._id,
          cloudinaryPublicId: img.cloudinaryPublicId,
          url: img.url,
          width: img.width ?? null,
          height: img.height ?? null,
          format: img.format ?? null,
          sizeBytes: img.sizeBytes ?? 0,
          altText: img.altText ?? "",
          order: existingCount + i,
        }));
        // Mongoose 8 requires `ordered: true` for multi-doc create() in a session.
        const created = await GalleryItem.create(docs, { session, ordered: true });
        for (const c of created) itemIds.push(String(c._id));

        // Set a cover image if the collection doesn't have one yet.
        if (!collection.coverItemId && created[0]) {
          await GalleryCollection.updateOne(
            { _id: collection._id, workspaceId },
            { $set: { coverItemId: created[0]._id } },
            { session }
          );
        }
      }

      // 4. Build seed data and wire the collection + featured items into it.
      const seeded = template.seedData({
        workspace: { name: workspace.name, branding: mergedBranding },
      });
      injectGalleryRefs(seeded, String(collection._id), itemIds);

      // 5. Persist publicPage. Archive existing home data first so an accidental
      //    re-run is recoverable.
      const set: Record<string, unknown> = {
        "publicPage.templateId": templateId,
        "publicPage.data": seeded,
        "publicPage.brandKit": brandKit,
      };
      if (contact) set["publicPage.contact"] = contact;
      if (workspace.publicPage?.data?.home) {
        set["publicPage.previousData"] = workspace.publicPage.data;
      }
      await Workspace.updateOne({ _id: workspaceId }, { $set: set }, { session });
    });
  } catch (err) {
    console.error("[wizard] saveWizardOutput failed:", err);
    return { error: "save_failed" };
  } finally {
    await session.endSession();
  }

  revalidatePath("/page-builder");
  revalidatePath(`/w/${ctx.workspace.slug}`);
  revalidatePath(`/w/${ctx.workspace.slug}/gallery`);
  return { ok: true };
}

// Sends the owner back to a clean wizard: archives the current portfolio data to
// previousData, then nulls `data.home` so the page-builder entry redirects to
// the wizard again. Owner-only.
export async function resetPortfolioAction(): Promise<WizardActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  await connectDB();
  const workspaceId = ctx.workspace._id;

  const workspace = await Workspace.findById(workspaceId).select({ "publicPage.data": 1 }).lean();
  if (!workspace) return { error: "not_found" };

  const set: Record<string, unknown> = {
    "publicPage.data": { home: null, gallery: null },
  };
  if (workspace.publicPage?.data?.home) {
    set["publicPage.previousData"] = workspace.publicPage.data;
  }

  await Workspace.updateOne({ _id: workspaceId }, { $set: set });

  revalidatePath("/page-builder");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { PortfolioDraft, Workspace, type PortfolioDraftDoc } from "@/lib/db/models";
import type { PlanTier } from "@/lib/db/models/Workspace";
import { createDraftSchema, updateDraftSchema } from "@/lib/validators/portfolioDraft";
import { draftCapForPlan } from "@/lib/page-builder/drafts";
import type { PuckData } from "@/lib/page-builder/types";
import { reconcileGalleryImages, reconcileFeaturedCollections } from "@/lib/page-builder/reconcile";
import { PORTFOLIO_TEMPLATE_IDS } from "@/lib/page-builder/templates/types";
import { getTemplate } from "@/lib/page-builder/templates";

export type DraftSummary = {
  id: string;
  name: string;
  templateId: string;
  updatedAt: string;
};

export type FullDraft = DraftSummary & {
  data: { home: PuckData | null; gallery: PuckData | null };
  brandKit: unknown;
  contact: unknown;
  header: unknown;
  collectionsPopup: unknown;
  formLocale: string;
};

export type DraftMutationResult = { ok: true; draft: DraftSummary } | { error: string };
export type DraftLoadResult = { ok: true; draft: FullDraft } | { error: string };
export type DraftActionResult = { ok: true } | { error: string };

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

function toSummary(doc: PortfolioDraftDoc): DraftSummary {
  return {
    id: String(doc._id),
    name: doc.name,
    templateId: doc.templateId ?? "",
    updatedAt: (doc.updatedAt instanceof Date ? doc.updatedAt : new Date()).toISOString(),
  };
}

export async function createDraftAction(input: unknown): Promise<DraftMutationResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = createDraftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "invalid_data" };

  await connectDB();
  const workspaceId = ctx.workspace._id;
  const cap = draftCapForPlan(ctx.workspace.plan as PlanTier);

  const session = await mongoose.startSession();
  try {
    let result: DraftMutationResult = { error: "invalid_data" };
    try {
      await session.withTransaction(async () => {
        const dupe = await PortfolioDraft.findOne({ workspaceId, name: parsed.data.name })
          .select({ _id: 1 })
          .session(session)
          .lean();
        if (dupe) {
          result = { error: "name_taken" };
          return;
        }
        if (Number.isFinite(cap)) {
          const count = await PortfolioDraft.countDocuments({ workspaceId }).session(session);
          if (count >= cap) {
            result = { error: `draft_limit_reached:${cap}` };
            return;
          }
        }
        const [doc] = await PortfolioDraft.create(
          [
            {
              workspaceId,
              name: parsed.data.name,
              templateId: parsed.data.templateId || "",
              data: parsed.data.data,
              brandKit: parsed.data.brandKit,
              contact: parsed.data.contact,
              header: parsed.data.header,
              collectionsPopup: parsed.data.collectionsPopup,
              formLocale: parsed.data.formLocale || "",
            },
          ],
          { session }
        );
        result = { ok: true, draft: toSummary(doc) };
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) return { error: "name_taken" };
      throw err;
    }
    if ("ok" in result) revalidatePath("/portfolio");
    return result;
  } finally {
    await session.endSession();
  }
}

export async function updateDraftAction(input: unknown): Promise<DraftMutationResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = updateDraftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "invalid_data" };

  await connectDB();
  const workspaceId = ctx.workspace._id;

  const dupe = await PortfolioDraft.findOne({
    workspaceId,
    name: parsed.data.name,
    _id: { $ne: parsed.data.id },
  })
    .select({ _id: 1 })
    .lean();
  if (dupe) return { error: "name_taken" };

  let doc;
  try {
    doc = await PortfolioDraft.findOneAndUpdate(
      { _id: parsed.data.id, workspaceId },
      {
        $set: {
          name: parsed.data.name,
          templateId: parsed.data.templateId || "",
          data: parsed.data.data,
          brandKit: parsed.data.brandKit,
          contact: parsed.data.contact,
          header: parsed.data.header,
          collectionsPopup: parsed.data.collectionsPopup,
          formLocale: parsed.data.formLocale || "",
        },
      },
      { new: true }
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) return { error: "name_taken" };
    throw err;
  }
  if (!doc) return { error: "draft_not_found" };
  revalidatePath("/portfolio");
  return { ok: true, draft: toSummary(doc) };
}

export async function deleteDraftAction(id: unknown): Promise<DraftActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };
  const idParsed = z.string().min(1).max(64).safeParse(id);
  if (!idParsed.success) return { error: "invalid_id" };

  await connectDB();
  await PortfolioDraft.deleteOne({ _id: idParsed.data, workspaceId: ctx.workspace._id });
  revalidatePath("/portfolio");
  return { ok: true };
}

export async function listDraftsAction(): Promise<DraftSummary[]> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return [];
  await connectDB();
  const docs = await PortfolioDraft.find({ workspaceId: ctx.workspace._id })
    .sort({ updatedAt: -1 })
    .select({ name: 1, templateId: 1, updatedAt: 1 })
    .lean();
  return docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    templateId: d.templateId ?? "",
    updatedAt: (d.updatedAt instanceof Date ? d.updatedAt : new Date()).toISOString(),
  }));
}

export async function getDraftAction(id: unknown): Promise<DraftLoadResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };
  const idParsed = z.string().min(1).max(64).safeParse(id);
  if (!idParsed.success) return { error: "invalid_id" };

  await connectDB();
  const doc = await PortfolioDraft.findOne({ _id: idParsed.data, workspaceId: ctx.workspace._id }).lean();
  if (!doc) return { error: "draft_not_found" };
  return {
    ok: true,
    draft: {
      id: String(doc._id),
      name: doc.name,
      templateId: doc.templateId ?? "",
      updatedAt: (doc.updatedAt instanceof Date ? doc.updatedAt : new Date()).toISOString(),
      data: {
        home: (doc.data?.home as PuckData | null) ?? null,
        gallery: (doc.data?.gallery as PuckData | null) ?? null,
      },
      brandKit: doc.brandKit ?? null,
      contact: doc.contact ?? null,
      header: doc.header ?? null,
      collectionsPopup: doc.collectionsPopup ?? null,
      formLocale: doc.formLocale ?? "",
    },
  };
}

export type SeedTemplateResult =
  | {
      ok: true;
      seed: {
        templateId: string;
        data: { home: PuckData; gallery: PuckData };
        brandKit: unknown;
        contact: unknown;
      };
    }
  | { error: string };

/**
 * Return the seeded data for a template without writing to the DB.
 * Used by the editor to apply a template as a new unsaved draft.
 */
export async function seedTemplateAction(templateId: unknown): Promise<SeedTemplateResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = z.enum(PORTFOLIO_TEMPLATE_IDS).safeParse(templateId);
  if (!parsed.success) return { error: "invalid_template" };

  const template = getTemplate(parsed.data);
  if (!template) return { error: "unknown_template" };

  const data = template.seedData({
    workspace: { name: ctx.workspace.name as string },
  });

  return {
    ok: true,
    seed: {
      templateId: template.id,
      data: {
        home: (data.home as PuckData) ?? { content: [], root: {} },
        gallery: (data.gallery as PuckData) ?? { content: [], root: {} },
      },
      brandKit: template.defaultBrandKit,
      contact: template.defaultContact,
    },
  };
}

export async function publishDraftAction(id: unknown): Promise<DraftActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };
  const idParsed = z.string().min(1).max(64).safeParse(id);
  if (!idParsed.success) return { error: "invalid_id" };

  await connectDB();
  const workspaceId = ctx.workspace._id;
  const doc = await PortfolioDraft.findOne({ _id: idParsed.data, workspaceId }).lean();
  if (!doc) return { error: "draft_not_found" };

  const wsIdStr = String(workspaceId);
  const home = (doc.data?.home as PuckData | null) ?? null;
  const gallery = (doc.data?.gallery as PuckData | null) ?? null;

  const set: Record<string, unknown> = {};
  set["publicPage.data.home"] = home
    ? await reconcileFeaturedCollections(wsIdStr, await reconcileGalleryImages(wsIdStr, home))
    : null;
  set["publicPage.data.gallery"] = gallery
    ? await reconcileFeaturedCollections(wsIdStr, await reconcileGalleryImages(wsIdStr, gallery))
    : null;
  // A fully-saved draft always carries these (brandKit required, the rest default
  // to {}). The guards only skip a null left by a migrated/legacy draft, so we
  // never overwrite live published config with null.
  if (doc.brandKit) set["publicPage.brandKit"] = doc.brandKit;
  if (doc.contact) set["publicPage.contact"] = doc.contact;
  if (doc.header) set["publicPage.header"] = doc.header;
  if (doc.collectionsPopup) set["publicPage.collectionsPopup"] = doc.collectionsPopup;
  set["publicPage.formLocale"] = doc.formLocale ?? "";
  set["publicPage.templateId"] =
    doc.templateId &&
    PORTFOLIO_TEMPLATE_IDS.includes(doc.templateId as (typeof PORTFOLIO_TEMPLATE_IDS)[number])
      ? doc.templateId
      : "minimal";

  const now = new Date();
  set["publicPage.publishedAt"] = now;
  set["publicPage.lastPublishedAt"] = now;

  await Workspace.updateOne({ _id: workspaceId }, { $set: set });

  revalidatePath(`/w/${ctx.workspace.slug}`);
  revalidatePath(`/w/${ctx.workspace.slug}/gallery`);
  revalidatePath("/sitemap.xml");
  return { ok: true };
}

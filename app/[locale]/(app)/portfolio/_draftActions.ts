"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { PortfolioDraft, Workspace, GalleryItem, type PortfolioDraftDoc } from "@/lib/db/models";
import type { PlanTier } from "@/lib/db/models/Workspace";
import { createDraftSchema, updateDraftSchema } from "@/lib/validators/portfolioDraft";
import { demoImportSchema } from "@/lib/validators/demoImport";
import { draftCapForPlan } from "@/lib/page-builder/drafts";
import type { PuckData } from "@/lib/page-builder/types";
import { reconcileGalleryImages, reconcileFeaturedCollections } from "@/lib/page-builder/reconcile";
import { PORTFOLIO_TEMPLATE_IDS } from "@/lib/page-builder/templates/types";
import { getTemplate } from "@/lib/page-builder/templates";
import { normalizeSharedChromeData, readNavigationConfig } from "@/lib/page-builder/sharedChrome";
import { deleteImage, verifyImageOwnership, updateImageMetadata, imageDeliveryUrl, DEMO_UPLOAD_SUBFOLDER } from "@/lib/storage/cloudflareImages";

/** Auto-name for a draft created from an imported Portfolio Maker demo. */
const DEMO_IMPORT_DRAFT_NAME = "Demo portfolio";

export type DraftSummary = {
  id: string;
  name: string;
  templateId: string;
  updatedAt: string;
};

export type FullDraft = DraftSummary & {
  data: {
    home: PuckData | null;
    gallery: PuckData | null;
    navigation: PuckData | null;
    footer: PuckData | null;
  };
  brandKit: unknown;
  contact: unknown;
  header: unknown;
  collectionsPopup: unknown;
  formLocale: string;
  formDir: string;
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
  const normalizedData = normalizeSharedChromeData(parsed.data.data, parsed.data.header);

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
              templateId: parsed.data.templateId || "scratch",
              data: normalizedData,
              brandKit: parsed.data.brandKit,
              contact: parsed.data.contact,
              header: parsed.data.header,
              collectionsPopup: parsed.data.collectionsPopup,
              formLocale: parsed.data.formLocale || "",
              formDir: parsed.data.formDir || "",
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
  const normalizedData = normalizeSharedChromeData(parsed.data.data, parsed.data.header);

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
          templateId: parsed.data.templateId || "scratch",
          data: normalizedData,
          brandKit: parsed.data.brandKit,
          contact: parsed.data.contact,
          header: parsed.data.header,
          collectionsPopup: parsed.data.collectionsPopup,
          formLocale: parsed.data.formLocale || "",
          formDir: parsed.data.formDir || "",
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
  const target = await PortfolioDraft.findOne({ _id: idParsed.data, workspaceId: ctx.workspace._id })
    .select({ _id: 1 })
    .lean();
  if (!target) {
    revalidatePath("/portfolio");
    return { ok: true };
  }
  const count = await PortfolioDraft.countDocuments({ workspaceId: ctx.workspace._id });
  if (count <= 1) return { error: "last_draft" };
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
        navigation: (doc.data?.navigation as PuckData | null) ?? null,
        footer: (doc.data?.footer as PuckData | null) ?? null,
      },
      brandKit: doc.brandKit ?? null,
      contact: doc.contact ?? null,
      header: doc.header ?? null,
      collectionsPopup: doc.collectionsPopup ?? null,
      formLocale: doc.formLocale ?? "",
      formDir: doc.formDir ?? "",
    },
  };
}

export type SeedTemplateResult =
  | {
      ok: true;
      seed: {
        templateId: string;
        data: {
          home: PuckData;
          gallery: PuckData;
          navigation: PuckData;
          footer: PuckData;
        };
        brandKit: unknown;
        contact: unknown;
        header: unknown;
        collectionsPopup: unknown;
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

  const normalizedData = normalizeSharedChromeData(
    {
      home: (data.home as PuckData) ?? null,
      gallery: (data.gallery as PuckData) ?? null,
    },
    template.defaultHeader,
  );

  return {
    ok: true,
    seed: {
      templateId: template.id,
      data: {
        home: normalizedData.home,
        gallery: normalizedData.gallery,
        navigation: normalizedData.navigation,
        footer: normalizedData.footer,
      },
      brandKit: template.defaultBrandKit,
      contact: template.defaultContact,
      header: template.defaultHeader,
      collectionsPopup: template.defaultCollectionsPopup,
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
  const [doc, workspace] = await Promise.all([
    PortfolioDraft.findOne({ _id: idParsed.data, workspaceId }).lean(),
    Workspace.findById(workspaceId)
      .select({
        "publicPage.settingsDraft": 1,
        "publicPage.seo.ogImageAssetId": 1,
        "publicPage.siteIcon.assetId": 1,
        "publicPage.header.logoAssetId": 1,
      })
      .lean(),
  ]);
  if (!doc) return { error: "draft_not_found" };

  // Captured before the promote-write below, so we can delete a live
  // og/icon/logo image that publish is about to supersede — but only if it
  // was actually live.
  const liveOgAssetId = workspace?.publicPage?.seo?.ogImageAssetId || undefined;
  const liveSiteIconAssetId = workspace?.publicPage?.siteIcon?.assetId || undefined;
  const liveLogoAssetId = workspace?.publicPage?.header?.logoAssetId || undefined;

  const wsIdStr = String(workspaceId);
  const normalizedData = normalizeSharedChromeData(
    {
      home: (doc.data?.home as PuckData | null) ?? null,
      gallery: (doc.data?.gallery as PuckData | null) ?? null,
      navigation: (doc.data?.navigation as PuckData | null) ?? null,
      footer: (doc.data?.footer as PuckData | null) ?? null,
    },
    doc.header,
  );
  const home = normalizedData.home;
  const gallery = normalizedData.gallery;

  const set: Record<string, unknown> = {};
  set["publicPage.data.home"] = home
    ? await reconcileFeaturedCollections(wsIdStr, await reconcileGalleryImages(wsIdStr, home))
    : null;
  set["publicPage.data.gallery"] = gallery
    ? await reconcileFeaturedCollections(wsIdStr, await reconcileGalleryImages(wsIdStr, gallery))
    : null;
  set["publicPage.data.navigation"] = normalizedData.navigation;
  set["publicPage.data.footer"] = normalizedData.footer;
  // A fully-saved draft always carries these (brandKit required, the rest default
  // to {}). The guards only skip a null left by a migrated/legacy draft, so we
  // never overwrite live published config with null.
  if (doc.brandKit) set["publicPage.brandKit"] = doc.brandKit;
  if (doc.contact) set["publicPage.contact"] = doc.contact;
  // The staged settings-page logo (if any) is the source of truth for the
  // published header logo, independent of whether the draft snapshot itself
  // carries a header object — a null/migrated draft.header must not cause
  // publish to skip promoting a staged logo (or clearing a removed one), and
  // must not leave the leak-safe delete below computing against a value that
  // was never actually written.
  const settingsDraftLogo = workspace?.publicPage?.settingsDraft?.logo;
  const navigationHeader = readNavigationConfig(normalizedData.navigation, doc.header ?? {});
  if (doc.header || normalizedData.navigation || settingsDraftLogo) {
    set["publicPage.header"] = settingsDraftLogo
      ? {
          ...navigationHeader,
          logoUrl: settingsDraftLogo.assetId ? settingsDraftLogo.url ?? "" : "",
          logoAssetId: settingsDraftLogo.assetId ?? "",
        }
      : navigationHeader;
  }
  if (doc.collectionsPopup) set["publicPage.collectionsPopup"] = doc.collectionsPopup;
  set["publicPage.formLocale"] = doc.formLocale ?? "";
  set["publicPage.formDir"] = doc.formDir ?? "";
  set["publicPage.seoTitle"] = doc.seoTitle ?? "";
  set["publicPage.seoDescription"] = doc.seoDescription ?? "";
  set["publicPage.siteIcon.url"] = doc.siteIcon?.url ?? "";
  set["publicPage.siteIcon.assetId"] = doc.siteIcon?.assetId ?? "";
  set["publicPage.seo.ogImageUrl"] = doc.seo?.ogImageUrl ?? "";
  set["publicPage.seo.ogImageAssetId"] = doc.seo?.ogImageAssetId ?? "";
  set["publicPage.seo.galleryDescription"] = doc.seo?.galleryDescription ?? "";
  set["publicPage.seo.noindex"] = doc.seo?.noindex ?? false;
  set["publicPage.seo.keywords"] = doc.seo?.keywords ?? [];
  const settingsDraft = workspace?.publicPage?.settingsDraft;
  if (settingsDraft) {
    set["publicPage.seoTitle"] = settingsDraft.seoTitle ?? "";
    set["publicPage.seoDescription"] = settingsDraft.seoDescription ?? "";
    set["publicPage.siteIcon.url"] = settingsDraft.siteIcon?.url ?? "";
    set["publicPage.siteIcon.assetId"] = settingsDraft.siteIcon?.assetId ?? "";
    set["publicPage.seo.keywords"] = settingsDraft.seo?.keywords ?? [];
    set["publicPage.seo.ogImageUrl"] = settingsDraft.seo?.ogImageUrl ?? "";
    set["publicPage.seo.ogImageAssetId"] = settingsDraft.seo?.ogImageAssetId ?? "";
    set["publicPage.seo.galleryDescription"] =
      settingsDraft.seo?.galleryDescription ?? "";
    set["publicPage.seo.noindex"] = settingsDraft.seo?.noindex ?? false;
  }
  set["publicPage.templateId"] =
    doc.templateId &&
    PORTFOLIO_TEMPLATE_IDS.includes(doc.templateId as (typeof PORTFOLIO_TEMPLATE_IDS)[number])
      ? doc.templateId
      : "scratch";

  const now = new Date();
  set["publicPage.publishedAt"] = now;
  set["publicPage.lastPublishedAt"] = now;

  await Workspace.updateOne({ _id: workspaceId }, { $set: set });

  const newOgAssetId = (set["publicPage.seo.ogImageAssetId"] as string | undefined) || undefined;
  if (liveOgAssetId && liveOgAssetId !== newOgAssetId) {
    try {
      await deleteImage(liveOgAssetId);
    } catch (err) {
      console.warn("[portfolio] failed to delete superseded live OG image asset", err);
    }
  }
  const newSiteIconAssetId =
    (set["publicPage.siteIcon.assetId"] as string | undefined) || undefined;
  if (liveSiteIconAssetId && liveSiteIconAssetId !== newSiteIconAssetId) {
    try {
      await deleteImage(liveSiteIconAssetId);
    } catch (err) {
      console.warn("[portfolio] failed to delete superseded live site icon asset", err);
    }
  }
  const newLogoAssetId =
    (set["publicPage.header"] as { logoAssetId?: string } | undefined)?.logoAssetId || undefined;
  if (liveLogoAssetId && liveLogoAssetId !== newLogoAssetId) {
    try {
      await deleteImage(liveLogoAssetId);
    } catch (err) {
      console.warn("[portfolio] failed to delete superseded live logo asset", err);
    }
  }

  revalidatePath(`/w/${ctx.workspace.slug}`);
  revalidatePath(`/w/${ctx.workspace.slug}/gallery`);
  revalidatePath("/sitemap.xml");
  return { ok: true };
}

export type DemoImportResult =
  | { ok: true; draft: DraftSummary; failedAssetIds: string[] }
  | { error: string };

/**
 * Claims a Portfolio Maker demo session's content into a brand-new draft for
 * the caller's own workspace: verifies + re-parents each demo-uploaded
 * Cloudflare asset (creating a GalleryItem for it), then creates a draft
 * seeded from the demo's blocks/brandKit/contact/header/collectionsPopup.
 *
 * Trust boundary: `workspaceId` is never taken from the client — it is always
 * resolved from the caller's own session via requireOrg(). Each image is only
 * re-parented after verifyImageOwnership confirms its CURRENT Cloudflare
 * metadata marks it as belonging to the claimed demoSessionId (demo uploads
 * are tagged with the demo session id in that field — see
 * app/api/portfolio-maker-demo/upload/route.ts) — a caller cannot hand in an
 * arbitrary publicId and adopt another workspace's (or another demo
 * session's) asset.
 *
 * Idempotent for the GalleryItem side: an asset already re-parented into this
 * workspace (existing GalleryItem row for the same workspaceId+assetId) is
 * left alone on a retried import rather than duplicated. A single asset
 * failure never aborts the rest — failures are collected into
 * `failedAssetIds` and the draft is still created from whatever succeeded.
 */
export async function importDemoPortfolioAction(input: unknown): Promise<DemoImportResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = demoImportSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_data" };

  await connectDB();
  const workspaceId = ctx.workspace._id;
  const wsIdStr = String(workspaceId);
  const { demoSessionId, draft, images } = parsed.data;

  const failedAssetIds: string[] = [];
  for (const img of images) {
    try {
      const owned = await verifyImageOwnership(
        img.publicId,
        demoSessionId,
        DEMO_UPLOAD_SUBFOLDER
      );
      if (!owned) {
        failedAssetIds.push(img.publicId);
        continue;
      }
      await updateImageMetadata(img.publicId, { workspaceId: wsIdStr, subfolder: "gallery" });
      const existing = await GalleryItem.findOne({ workspaceId, assetId: img.publicId })
        .select({ _id: 1 })
        .lean();
      if (!existing) {
        const order = await GalleryItem.countDocuments({ workspaceId, collectionId: null });
        await GalleryItem.create({
          workspaceId,
          assetId: img.publicId,
          // Never the client-supplied url — img is untrusted (it comes
          // straight out of localStorage) and demoImportImageSchema does not
          // even accept a url field. Always derive from the ownership-verified
          // publicId, same as every other read path (lib/db/queries/gallery.ts).
          url: imageDeliveryUrl(img.publicId),
          width: img.width ?? null,
          height: img.height ?? null,
          order,
        });
      }
    } catch (err) {
      console.error("[portfolio] demo import: failed to claim asset", img.publicId, err);
      failedAssetIds.push(img.publicId);
    }
  }

  // Retried imports (dropped response after a server-side success, double-submit
  // that beats the UI's busy flag) are keyed on demoSessionId, not name — the
  // GalleryItem re-parenting above already reran idempotently, so returning the
  // existing draft here is correct rather than minting a second "Demo portfolio
  // (2)" draft.
  const existingDemoDraft = await PortfolioDraft.findOne({ workspaceId, demoSessionId });
  if (existingDemoDraft) {
    revalidatePath("/portfolio");
    return { ok: true, draft: toSummary(existingDemoDraft), failedAssetIds };
  }

  const cap = draftCapForPlan(ctx.workspace.plan as PlanTier);
  if (Number.isFinite(cap)) {
    const count = await PortfolioDraft.countDocuments({ workspaceId });
    if (count >= cap) return { error: `draft_limit_reached:${cap}` };
  }

  let name = DEMO_IMPORT_DRAFT_NAME;
  let doc: PortfolioDraftDoc | null = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const [created] = await PortfolioDraft.create([
        {
          workspaceId,
          name,
          demoSessionId,
          templateId: draft.templateId || "scratch",
          data: draft.data,
          brandKit: draft.brandKit,
          contact: draft.contact,
          header: draft.header,
          collectionsPopup: draft.collectionsPopup,
          formLocale: draft.formLocale || "",
          formDir: draft.formDir || "",
        },
      ]);
      doc = created;
      break;
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      // A conflict on demoSessionId means a concurrent request won the create
      // race, not a genuine name collision — fetch and return its draft
      // instead of renaming (renaming would spin all 20 attempts and wrongly
      // report name_taken).
      const keyPattern = (err as { keyPattern?: Record<string, unknown> } | null)?.keyPattern;
      if (keyPattern && "demoSessionId" in keyPattern) {
        const winner = await PortfolioDraft.findOne({ workspaceId, demoSessionId });
        if (winner) {
          doc = winner;
          break;
        }
      }
      name = `${DEMO_IMPORT_DRAFT_NAME} (${attempt + 2})`;
    }
  }
  if (!doc) return { error: "name_taken" };

  revalidatePath("/portfolio");
  return { ok: true, draft: toSummary(doc), failedAssetIds };
}


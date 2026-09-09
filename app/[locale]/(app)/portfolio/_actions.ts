"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import {
  puckDataSchema,
  brandKitSchema,
  portfolioContactConfigSchema,
  portfolioCollectionsPopupConfigSchema,
} from "@/lib/validators/publicPage";
import { slugSchema } from "@/lib/validators/workspace";
import { reseedPortfolioFromTemplate, type PortfolioSeed } from "@/lib/page-builder/seedPortfolio";
import { PORTFOLIO_TEMPLATE_IDS } from "@/lib/page-builder/templates/types";
import { SAVED_THEMES_MAX, type PortfolioSavedTheme } from "@/lib/page-builder/types";
import { isThemeNameTaken } from "@/lib/page-builder/themeNames";
import { reconcileGalleryImages, reconcileFeaturedCollections } from "@/lib/page-builder/reconcile";
import type { PuckData } from "@/lib/page-builder/types";
import { deleteImage, verifyImageOwnership } from "@/lib/storage/cloudflareImages";
import { z } from "zod";

export type EditorActionResult =
  | { ok: true; savedAt?: string }
  | { error: string };

const PORTFOLIO_ZONES = ["home", "gallery"] as const;
// Prevent a single Puck zone save from pushing the Workspace doc toward
// MongoDB's 16 MB BSON limit. 512 KB covers every realistic portfolio while
// blocking runaway autosave abuse. Measured after JSON.stringify because that
// is what Mongoose serialises to BSON.
const MAX_PUCK_ZONE_BYTES = 512 * 1024; // 512 KB
const saveDraftSchema = z.object({
  zone: z.enum(PORTFOLIO_ZONES),
  data: puckDataSchema,
});

export type SavePortfolioDraftInput = z.infer<typeof saveDraftSchema>;

/**
 * Persist a single zone's Puck data. Owner-only. Writes only the touched zone
 * and bumps latestVersion so a future history/version UI has a monotonic marker.
 * Draft only — does NOT change publish state.
 */
export async function savePortfolioDraftAction(
  input: SavePortfolioDraftInput
): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "invalid_data" };
  }

  if (JSON.stringify(parsed.data.data).length > MAX_PUCK_ZONE_BYTES) {
    return { error: "payload_too_large" };
  }

  await connectDB();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    {
      $set: { [`publicPage.data.${parsed.data.zone}`]: parsed.data.data },
      // Monotonic write counter (bumps on every autosave, not per "published
      // version") — a cheap marker a future history/version UI can build on.
      $inc: { "publicPage.latestVersion": 1 },
    }
  );

  return { ok: true, savedAt: new Date().toISOString() };
}

/**
 * Publish the current draft. Owner-only. Reconciles gallery block image caches
 * against live GalleryItems (refresh publicId/alt, prune deleted), persists the
 * reconciled data, THEN flips publishedAt/lastPublishedAt and revalidates public
 * routes + sitemap so the live page renders fresh, fetch-free images.
 */
export async function publishPortfolioAction(): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  await connectDB();
  const workspaceId = String(ctx.workspace._id);

  // Read current draft zones, reconcile their gallery images against live
  // GalleryItems, and persist the refreshed data so the live page renders fresh,
  // fetch-free images. Reconcile runs BEFORE publishedAt is set.
  const ws = await Workspace.findById(ctx.workspace._id)
    .select({ "publicPage.data.home": 1, "publicPage.data.gallery": 1 })
    .lean();

  const set: Record<string, unknown> = {};
  const home = ws?.publicPage?.data?.home as PuckData | null | undefined;
  const gallery = ws?.publicPage?.data?.gallery as PuckData | null | undefined;
  if (home) set["publicPage.data.home"] = await reconcileFeaturedCollections(workspaceId, await reconcileGalleryImages(workspaceId, home));
  if (gallery) set["publicPage.data.gallery"] = await reconcileFeaturedCollections(workspaceId, await reconcileGalleryImages(workspaceId, gallery));

  const now = new Date();
  set["publicPage.publishedAt"] = now;
  set["publicPage.lastPublishedAt"] = now;

  await Workspace.updateOne({ _id: ctx.workspace._id }, { $set: set });

  revalidatePath(`/w/${ctx.workspace.slug}`);
  revalidatePath(`/w/${ctx.workspace.slug}/gallery`);
  revalidatePath("/sitemap.xml");
  return { ok: true };
}

/** Persist the brand kit (applied at the public-page wrapper). Owner-only. */
export async function updateBrandKitAction(
  input: unknown
): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = brandKitSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "invalid_brand_kit" };
  }

  await connectDB();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { "publicPage.brandKit": parsed.data } }
  );

  revalidatePath(`/w/${ctx.workspace.slug}`);
  revalidatePath(`/w/${ctx.workspace.slug}/gallery`);
  return { ok: true };
}

/** Persist the prebuilt contact modal's copy/button presentation. Owner-only. */
export async function updateContactConfigAction(
  input: unknown
): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = portfolioContactConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "invalid_contact" };
  }

  await connectDB();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { "publicPage.contact": parsed.data } }
  );

  revalidatePath(`/w/${ctx.workspace.slug}`);
  return { ok: true };
}

/** Persist the collections popup style config. Owner-only. */
export async function updateCollectionsPopupConfigAction(
  input: unknown
): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = portfolioCollectionsPopupConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "invalid_collections_popup" };
  }

  await connectDB();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { "publicPage.collectionsPopup": parsed.data } }
  );

  revalidatePath(`/w/${ctx.workspace.slug}`);
  return { ok: true };
}

const switchTemplateSchema = z.object({ templateId: z.enum(PORTFOLIO_TEMPLATE_IDS) });

export type SwitchTemplateResult = { ok: true; seed: PortfolioSeed } | { error: string };

/**
 * Re-seed both portfolio zones from another starter template. Owner-only.
 * Archives the current data to previousData (handled in reseedPortfolioFromTemplate)
 * and resets brand kit + contact to the template defaults. Returns the new seed
 * so the editor can reload its zones without a full navigation.
 */
export async function switchTemplateAction(input: unknown): Promise<SwitchTemplateResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = switchTemplateSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_template" };

  const seed = await reseedPortfolioFromTemplate(ctx.workspace._id, parsed.data.templateId);
  if (!seed) return { error: "unknown_template" };

  revalidatePath("/portfolio");
  revalidatePath(`/w/${ctx.workspace.slug}`);
  revalidatePath(`/w/${ctx.workspace.slug}/gallery`);
  return { ok: true, seed };
}

/**
 * Persist the owner's "don't show the guide again" choice. Owner-only.
 * Idempotent — re-dismissing just rewrites the timestamp.
 */
export async function dismissPortfolioGuideAction(): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  await connectDB();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { "publicPage.guideDismissedAt": new Date() } }
  );
  return { ok: true };
}

const completeStoryPromptSchema = z.object({
  description: z.string().max(300).trim(),
  keywords: z.array(z.string().trim().min(1).max(40)).max(10),
  logoUrl: z.string().max(500).optional().or(z.literal("")),
  logoAssetId: z.string().max(200).optional().or(z.literal("")),
  siteIconUrl: z.string().max(500).optional().or(z.literal("")),
  siteIconAssetId: z.string().max(200).optional().or(z.literal("")),
  ogImageUrl: z.string().max(500).optional().or(z.literal("")),
  ogImageAssetId: z.string().max(200).optional().or(z.literal("")),
  inquiryRecipientEmail: z.union([z.string().trim().email(), z.literal("")]).optional().default(""),
});

/**
 * Persist the owner's first-visit "story prompt" answers (SEO description,
 * style tags, and optionally a logo/site-icon upload from the wizard's
 * branding step), captured before the editor's Guide tour opens. Owner-only.
 * Idempotent — re-submitting just rewrites the fields and the timestamp.
 * seoDescription/keywords/logo/site icon/OG image land on
 * Workspace.publicPage.settingsDraft — the same workspace-level buffer the
 * /settings/public-page form writes to — so this data is independent of
 * whichever PortfolioDraft happens to be active, and is promoted live only
 * by the explicit Publish action. Only the one-time completion flag +
 * inquiry recipient land live on Workspace.publicPage, since they gate the
 * wizard/drive the live inquiry routing directly and have no draft/publish
 * lifecycle of their own.
 */
export async function completeStoryPromptAction(input: unknown): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = completeStoryPromptSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_request" };

  await connectDB();
  const workspaceId = String(ctx.workspace._id);
  const newLogoAssetId = parsed.data.logoAssetId || undefined;
  const newSiteIconAssetId = parsed.data.siteIconAssetId || undefined;
  const newOgImageAssetId = parsed.data.ogImageAssetId || undefined;

  // Verify ownership before persisting any new asset id — prevents a
  // workspace from referencing an image uploaded by a different workspace.
  if (newLogoAssetId) {
    const owned = await verifyImageOwnership(newLogoAssetId, workspaceId);
    if (!owned) return { error: "invalid_logo" };
  }
  if (newSiteIconAssetId) {
    const owned = await verifyImageOwnership(newSiteIconAssetId, workspaceId);
    if (!owned) return { error: "invalid_site_icon" };
  }
  if (newOgImageAssetId) {
    const owned = await verifyImageOwnership(newOgImageAssetId, workspaceId);
    if (!owned) return { error: "invalid_og_image" };
  }

  // Old asset ids come from two places: the draft buffer (what this write is
  // about to replace) and the live published page. A replaced draft-only
  // asset is safe to delete; an asset still referenced by the live public
  // page must never be deleted out from under it, even if the draft buffer
  // is moving on to something else (leak-safe rule).
  let oldLogoAssetId: string | undefined;
  let liveLogoAssetId: string | undefined;
  let oldSiteIconAssetId: string | undefined;
  let liveSiteIconAssetId: string | undefined;
  let oldOgImageAssetId: string | undefined;
  let liveOgImageAssetId: string | undefined;
  if (newLogoAssetId || newSiteIconAssetId || newOgImageAssetId) {
    const current = await Workspace.findById(ctx.workspace._id, {
      "publicPage.settingsDraft.logo.assetId": 1,
      "publicPage.settingsDraft.siteIcon.assetId": 1,
      "publicPage.settingsDraft.seo.ogImageAssetId": 1,
      "publicPage.header.logoAssetId": 1,
      "publicPage.siteIcon.assetId": 1,
      "publicPage.seo.ogImageAssetId": 1,
    }).lean();
    oldLogoAssetId = current?.publicPage?.settingsDraft?.logo?.assetId || undefined;
    liveLogoAssetId = current?.publicPage?.header?.logoAssetId || undefined;
    oldSiteIconAssetId = current?.publicPage?.settingsDraft?.siteIcon?.assetId || undefined;
    liveSiteIconAssetId = current?.publicPage?.siteIcon?.assetId || undefined;
    oldOgImageAssetId = current?.publicPage?.settingsDraft?.seo?.ogImageAssetId || undefined;
    liveOgImageAssetId = current?.publicPage?.seo?.ogImageAssetId || undefined;
  }

  const set: Record<string, unknown> = {
    "publicPage.storyPromptCompletedAt": new Date(),
    "publicPage.inquiryRecipientEmail": parsed.data.inquiryRecipientEmail,
    "publicPage.settingsDraft.seoDescription": parsed.data.description,
    "publicPage.settingsDraft.seo.keywords": parsed.data.keywords,
  };
  if (newLogoAssetId) {
    set["publicPage.settingsDraft.logo.url"] = parsed.data.logoUrl ?? "";
    set["publicPage.settingsDraft.logo.assetId"] = newLogoAssetId;
  }
  if (newSiteIconAssetId) {
    set["publicPage.settingsDraft.siteIcon.url"] = parsed.data.siteIconUrl ?? "";
    set["publicPage.settingsDraft.siteIcon.assetId"] = newSiteIconAssetId;
  }
  if (newOgImageAssetId) {
    set["publicPage.settingsDraft.seo.ogImageUrl"] = parsed.data.ogImageUrl ?? "";
    set["publicPage.settingsDraft.seo.ogImageAssetId"] = newOgImageAssetId;
  }

  await Workspace.updateOne({ _id: ctx.workspace._id }, { $set: set });

  if (
    newLogoAssetId &&
    oldLogoAssetId &&
    oldLogoAssetId !== newLogoAssetId &&
    oldLogoAssetId !== liveLogoAssetId
  ) {
    try {
      await deleteImage(oldLogoAssetId);
    } catch (err) {
      console.warn("[portfolio] failed to delete old story-prompt logo asset", err);
    }
  }
  if (
    newSiteIconAssetId &&
    oldSiteIconAssetId &&
    oldSiteIconAssetId !== newSiteIconAssetId &&
    oldSiteIconAssetId !== liveSiteIconAssetId
  ) {
    try {
      await deleteImage(oldSiteIconAssetId);
    } catch (err) {
      console.warn("[portfolio] failed to delete old story-prompt site icon asset", err);
    }
  }
  if (
    newOgImageAssetId &&
    oldOgImageAssetId &&
    oldOgImageAssetId !== newOgImageAssetId &&
    oldOgImageAssetId !== liveOgImageAssetId
  ) {
    try {
      await deleteImage(oldOgImageAssetId);
    } catch (err) {
      console.warn("[portfolio] failed to delete old story-prompt share image asset", err);
    }
  }

  return { ok: true };
}

// "" = auto (locale derived from the workspace country).
const formLocaleSchema = z.enum(["", "en", "fil", "id", "ar", "th"]);

/**
 * Persist the per-page chrome language for the public portfolio (inquiry form,
 * nav, footer, gallery labels). Owner-only. "" restores the country-derived
 * default. Isolated from the owner's own app locale.
 */
export async function updateFormLocaleAction(input: unknown): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = formLocaleSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_locale" };

  await connectDB();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { "publicPage.formLocale": parsed.data } }
  );

  revalidatePath(`/w/${ctx.workspace.slug}`);
  revalidatePath(`/w/${ctx.workspace.slug}/gallery`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Saved themes
// ---------------------------------------------------------------------------

const saveThemeNameSchema = z.string().trim().min(1, "Name is required").max(60, "Max 60 chars");

export type SaveThemeResult =
  | { ok: true; theme: PortfolioSavedTheme }
  | { error: string };

/**
 * Save the current brand kit as a named reusable theme. Owner-only.
 * Enforces the SAVED_THEMES_MAX cap — rejects if the workspace is at the limit.
 * The id is generated server-side (crypto.randomUUID) so the client cannot
 * forge or collide it.
 */
export async function saveThemeAction(
  name: unknown,
  brandKit: unknown
): Promise<SaveThemeResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const nameParsed = saveThemeNameSchema.safeParse(name);
  if (!nameParsed.success) {
    return { error: nameParsed.error.errors[0]?.message ?? "invalid_name" };
  }

  const kitParsed = brandKitSchema.safeParse(brandKit);
  if (!kitParsed.success) {
    return { error: kitParsed.error.errors[0]?.message ?? "invalid_brand_kit" };
  }

  await connectDB();

  const current = await Workspace.findOne({ _id: ctx.workspace._id })
    .select({ "publicPage.savedThemes": 1 })
    .lean<{ publicPage?: { savedThemes?: PortfolioSavedTheme[] } }>();
  if (isThemeNameTaken(nameParsed.data, current?.publicPage?.savedThemes ?? [])) {
    return { error: "theme_name_exists" };
  }

  const newTheme: PortfolioSavedTheme = {
    id: crypto.randomUUID(),
    name: nameParsed.data,
    brandKit: kitParsed.data,
  };

  // Enforce the cap atomically: only push when the array isn't already at the
  // limit. A read-then-write check races against concurrent saves (two tabs /
  // double-submit) and a raw $push bypasses the schema's array validator.
  const res = await Workspace.updateOne(
    {
      _id: ctx.workspace._id,
      [`publicPage.savedThemes.${SAVED_THEMES_MAX - 1}`]: { $exists: false },
    },
    { $push: { "publicPage.savedThemes": newTheme } }
  );
  if (res.matchedCount === 0) {
    return { error: `max_themes_reached:${SAVED_THEMES_MAX}` };
  }

  return { ok: true, theme: newTheme };
}

/**
 * Edit a saved theme in place — same id, same array position. Owner-only.
 * Name uniqueness is enforced case-insensitively, excluding the theme being
 * updated so it can keep its own name. Scoped to the caller's workspace so it
 * can never mutate another tenant's themes.
 */
export async function updateThemeAction(
  id: unknown,
  name: unknown,
  brandKit: unknown
): Promise<SaveThemeResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const idParsed = z.string().min(1).max(64).safeParse(id);
  if (!idParsed.success) return { error: "invalid_id" };
  const nameParsed = saveThemeNameSchema.safeParse(name);
  if (!nameParsed.success) {
    return { error: nameParsed.error.errors[0]?.message ?? "invalid_name" };
  }
  const kitParsed = brandKitSchema.safeParse(brandKit);
  if (!kitParsed.success) {
    return { error: kitParsed.error.errors[0]?.message ?? "invalid_brand_kit" };
  }

  await connectDB();

  const current = await Workspace.findOne({ _id: ctx.workspace._id })
    .select({ "publicPage.savedThemes": 1 })
    .lean<{ publicPage?: { savedThemes?: PortfolioSavedTheme[] } }>();
  const savedThemes = current?.publicPage?.savedThemes ?? [];
  if (!savedThemes.some((t) => t.id === idParsed.data)) {
    return { error: "theme_not_found" };
  }
  if (isThemeNameTaken(nameParsed.data, savedThemes, idParsed.data)) {
    return { error: "theme_name_exists" };
  }

  const updated: PortfolioSavedTheme = {
    id: idParsed.data,
    name: nameParsed.data,
    brandKit: kitParsed.data,
  };
  // Positional update keeps the element's id and array position intact, and is
  // scoped to this workspace's _id so it can never touch another tenant.
  await Workspace.updateOne(
    { _id: ctx.workspace._id, "publicPage.savedThemes.id": idParsed.data },
    {
      $set: {
        "publicPage.savedThemes.$.name": updated.name,
        "publicPage.savedThemes.$.brandKit": updated.brandKit,
      },
    }
  );
  return { ok: true, theme: updated };
}

/**
 * Update the workspace's public URL slug. Owner-only.
 * Maps E11000 (unique index race) and pre-flight slug clash to "url_taken".
 */
export async function updatePortfolioSlugAction(
  slug: unknown,
): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return { error: "invalid_slug" };

  await connectDB();
  const clash = await Workspace.findOne({
    slug: parsed.data,
    _id: { $ne: ctx.workspace._id },
  }).lean();
  if (clash) return { error: "url_taken" };

  try {
    await Workspace.updateOne({ _id: ctx.workspace._id }, { slug: parsed.data });
    revalidatePath(`/w/${parsed.data}`);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: unknown }).code === 11000
    ) {
      return { error: "url_taken" };
    }
    throw err;
  }

  return { ok: true };
}

/**
 * Delete a saved theme by id. Owner-only. Silently no-ops if the id is absent
 * (idempotent so retries after a network blip are safe).
 */
export async function deleteThemeAction(id: unknown): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const idParsed = z.string().min(1).max(64).safeParse(id);
  if (!idParsed.success) return { error: "invalid_id" };

  await connectDB();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $pull: { "publicPage.savedThemes": { id: idParsed.data } } }
  );

  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import {
  puckDataSchema,
  brandKitSchema,
  portfolioContactConfigSchema,
  portfolioHeaderConfigSchema,
  portfolioCollectionsPopupConfigSchema,
} from "@/lib/validators/publicPage";
import { reseedPortfolioFromTemplate, type PortfolioSeed } from "@/lib/page-builder/seedPortfolio";
import { PORTFOLIO_TEMPLATE_IDS } from "@/lib/page-builder/templates/types";
import { SAVED_THEMES_MAX, type PortfolioSavedTheme } from "@/lib/page-builder/types";
import { isThemeNameTaken } from "@/lib/page-builder/themeNames";
import { reconcileGalleryImages, reconcileFeaturedCollections } from "@/lib/page-builder/reconcile";
import type { PuckData } from "@/lib/page-builder/types";
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

/** Persist the public portfolio navigation header configuration. Owner-only. */
export async function updateHeaderConfigAction(
  input: unknown
): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = portfolioHeaderConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "invalid_header" };
  }

  await connectDB();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { "publicPage.header": parsed.data } }
  );

  revalidatePath(`/w/${ctx.workspace.slug}`);
  revalidatePath(`/w/${ctx.workspace.slug}/gallery`);
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

// "" = auto (locale derived from the workspace country).
const formLocaleSchema = z.enum(["", "en", "fil", "ms", "id"]);

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

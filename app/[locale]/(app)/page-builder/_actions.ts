"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import {
  puckDataSchema,
  brandKitSchema,
  portfolioContactConfigSchema,
} from "@/lib/validators/publicPage";
import { z } from "zod";

export type EditorActionResult =
  | { ok: true; savedAt?: string }
  | { error: string };

const PORTFOLIO_ZONES = ["home", "gallery"] as const;
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

  await connectDB();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    {
      $set: { [`publicPage.data.${parsed.data.zone}`]: parsed.data.data },
      $inc: { "publicPage.latestVersion": 1 },
    }
  );

  return { ok: true, savedAt: new Date().toISOString() };
}

/**
 * Publish the current draft. Owner-only. Flips publishedAt/lastPublishedAt and
 * revalidates the public routes + sitemap so the live page reflects the latest.
 */
export async function publishPortfolioAction(): Promise<EditorActionResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  await connectDB();
  const now = new Date();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { "publicPage.publishedAt": now, "publicPage.lastPublishedAt": now } }
  );

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

"use server";

import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { emitDataChanged } from "@/lib/sockets/emitDataChanged";
import { Workspace } from "@/lib/db/models";
import { invoiceThemeSchema } from "@/lib/validators/invoiceTheme";
import {
  INVOICE_THEME_PRESETS,
  invoiceColorsFromBrandKit,
  readableTextOn,
  resolveInvoiceTheme,
  type InvoiceColors,
} from "@/lib/invoices/theme";

export type UpdateInvoiceThemeResult = { ok: true } | { error: string };

/**
 * Persist the workspace's invoice PDF theme. Owner-only. Server is
 * authoritative for preset colors — a client-sent preset's main/accent are
 * ignored and re-resolved server-side; only "custom" honors client colors.
 */
export async function updateInvoiceThemeAction(input: unknown): Promise<UpdateInvoiceThemeResult> {
  const ctx = await requireOrg();
  if (ctx.role !== "owner") return { error: "owner_only" };

  const parsed = invoiceThemeSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_data" };

  const { preset, savedThemeId } = parsed.data;
  const publicPage = ctx.workspace.publicPage;
  let resolved: InvoiceColors;
  let storedSavedThemeId: string | null = null;
  if (preset === "custom") {
    resolved = {
      main: parsed.data.main,
      accent: parsed.data.accent,
      text: parsed.data.text ?? readableTextOn(parsed.data.main),
    };
  } else if (preset === "saved") {
    // Tenant-scoped: only this workspace's own saved themes are searched.
    const saved = savedThemeId ? publicPage?.savedThemes?.find((t) => t.id === savedThemeId) : undefined;
    if (!saved?.brandKit) return { error: "invalid_data" };
    resolved = invoiceColorsFromBrandKit(saved.brandKit);
    storedSavedThemeId = savedThemeId ?? null;
  } else if (preset === "portfolio") {
    resolved = resolveInvoiceTheme({ preset, main: "", accent: "" }, publicPage?.brandKit);
  } else {
    resolved = INVOICE_THEME_PRESETS[preset];
  }

  await connectDB();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { invoiceTheme: { preset, savedThemeId: storedSavedThemeId, ...resolved } } }
  );

  emitDataChanged(String(ctx.workspace._id), { type: "workspace.updated" });
  return { ok: true };
}

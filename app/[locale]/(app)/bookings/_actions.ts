"use server";

import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace } from "@/lib/db/models";
import { invoiceThemeSchema } from "@/lib/validators/invoiceTheme";
import { INVOICE_THEME_PRESETS } from "@/lib/invoices/theme";

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

  const resolved =
    parsed.data.preset === "custom"
      ? { main: parsed.data.main, accent: parsed.data.accent }
      : INVOICE_THEME_PRESETS[parsed.data.preset];

  await connectDB();
  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { invoiceTheme: { preset: parsed.data.preset, ...resolved } } }
  );

  return { ok: true };
}

import { z } from "zod";
import { BRAND_KIT_THEME_PRESETS } from "@/lib/page-builder/types";

export const INVOICE_THEME_PRESET_IDS = [...BRAND_KIT_THEME_PRESETS, "portfolio", "saved", "custom"] as const;
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #1a1a1a");
export const invoiceThemeSchema = z.object({
  preset: z.enum(INVOICE_THEME_PRESET_IDS),
  savedThemeId: z.string().max(64).optional(),
  main: hexColorSchema,
  accent: hexColorSchema,
  text: hexColorSchema.optional(),
});

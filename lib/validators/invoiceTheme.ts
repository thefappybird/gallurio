import { z } from "zod";

export const INVOICE_THEME_PRESET_IDS = ["classic", "slate", "navyGold", "forest", "custom"] as const;
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #1a1a1a");
export const invoiceThemeSchema = z.object({
  preset: z.enum(INVOICE_THEME_PRESET_IDS),
  main: hexColorSchema,
  accent: hexColorSchema,
});

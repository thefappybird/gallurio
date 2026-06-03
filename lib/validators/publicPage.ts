import { z } from "zod";
import {
  BRAND_KIT_THEME_PRESETS,
  BRAND_KIT_FONT_PAIRS,
  BRAND_KIT_RADII,
  BRAND_KIT_BUTTON_STYLES,
  CONTACT_BUTTON_COLORS,
  SAVED_THEMES_MAX,
} from "@/lib/page-builder/types";
import { PORTFOLIO_FONT_KEYS } from "@/lib/page-builder/fonts";

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #1a1a1a");

// ---------------------------------------------------------------------------
// brandKitSchema
// ---------------------------------------------------------------------------

export const brandKitSchema = z.object({
  themePreset: z.enum(BRAND_KIT_THEME_PRESETS),
  // Legacy pairing kept for back-compat; new saves also carry independent fonts.
  fontPair: z.enum(BRAND_KIT_FONT_PAIRS),
  headingFont: z.enum(PORTFOLIO_FONT_KEYS).optional(),
  bodyFont: z.enum(PORTFOLIO_FONT_KEYS).optional(),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  foregroundColor: hexColorSchema,
  radius: z.enum(BRAND_KIT_RADII),
  buttonStyle: z.enum(BRAND_KIT_BUTTON_STYLES),
});

export type BrandKitInput = z.infer<typeof brandKitSchema>;

// ---------------------------------------------------------------------------
// Saved themes — owner's named, reusable brand kits (embedded on the workspace).
// ---------------------------------------------------------------------------

export const savedThemeSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1, "Name your theme").max(60),
  brandKit: brandKitSchema,
});

export const savedThemesSchema = z.array(savedThemeSchema).max(SAVED_THEMES_MAX);

export type SavedThemeInput = z.infer<typeof savedThemeSchema>;

// ---------------------------------------------------------------------------
// portfolioContactConfigSchema
//
// The only editable surface of the prebuilt contact modal: title/description
// copy and which curated brand color/style the button uses. The form fields
// stay fixed. All fields optional → modal falls back to brand kit + i18n.
// ---------------------------------------------------------------------------

export const portfolioContactConfigSchema = z.object({
  title: z.string().trim().max(80).optional().or(z.literal("")),
  description: z.string().trim().max(280).optional().or(z.literal("")),
  buttonStyle: z.enum(BRAND_KIT_BUTTON_STYLES).optional().or(z.literal("")),
  buttonColor: z.enum(CONTACT_BUTTON_COLORS).optional().or(z.literal("")),
});

export type PortfolioContactConfigInput = z.infer<typeof portfolioContactConfigSchema>;

// ---------------------------------------------------------------------------
// portfolioPuckDataSchema
//
// Loose on per-block prop validation — Puck's editor layer handles that via
// per-block Zod adapters added in Phase 3. We only validate the structural
// shape here so the Workspace model can do a surface-level check on save.
// ---------------------------------------------------------------------------

export const puckDataSchema = z.object({
  root: z.object({ props: z.record(z.unknown()).optional() }).optional(),
  content: z.array(
    z.object({
      type: z.string(),
      props: z.record(z.unknown()),
    })
  ),
  zones: z
    .record(
      z.array(
        z.object({
          type: z.string(),
          props: z.record(z.unknown()),
        })
      )
    )
    .optional(),
});

export const portfolioPuckDataSchema = z.object({
  home: puckDataSchema.nullable(),
  gallery: puckDataSchema.nullable(),
});

export type PortfolioPuckDataInput = z.infer<typeof portfolioPuckDataSchema>;

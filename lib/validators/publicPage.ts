import { z } from "zod";
import {
  BRAND_KIT_THEME_PRESETS,
  BRAND_KIT_FONT_PAIRS,
  BRAND_KIT_RADII,
  BRAND_KIT_BUTTON_STYLES,
} from "@/lib/page-builder/types";

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
  fontPair: z.enum(BRAND_KIT_FONT_PAIRS),
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
// portfolioPuckDataSchema
//
// Loose on per-block prop validation — Puck's editor layer handles that via
// per-block Zod adapters added in Phase 3. We only validate the structural
// shape here so the Workspace model can do a surface-level check on save.
// ---------------------------------------------------------------------------

const puckDataSchema = z.object({
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

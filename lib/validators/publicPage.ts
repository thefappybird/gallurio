import { z } from "zod";
import {
  BRAND_KIT_THEME_PRESETS,
  BRAND_KIT_FONT_PAIRS,
  BRAND_KIT_RADII,
  BRAND_KIT_BUTTON_STYLES,
  SAVED_THEMES_MAX,
  HEADER_SHADOW_SIZES,
  HEADER_FONT_SIZES,
  HEADER_NAVBAR_SIZES,
} from "@/lib/page-builder/types";
import { PORTFOLIO_FONT_KEYS, isPortfolioFontKey, type PortfolioFontSelection } from "@/lib/page-builder/fonts";

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #1a1a1a");

// A curated self-hosted key OR a `google:<Family Name>` selection (see
// lib/page-builder/fonts.ts — PortfolioFontSelection). The family name is
// restricted to a safe character set + length bound (not full font-name
// validation) since it's only ever used to build a Google Fonts CSS2 URL and
// set a CSS `font-family` value, never interpolated into raw CSS/HTML text.
// `z.custom` (not `z.union` with a plain regex `.string()`) so the inferred
// TS type is the branded `PortfolioFontSelection`, not a widened `string`.
const GOOGLE_FONT_SELECTION_RE = /^google:[A-Za-z0-9][A-Za-z0-9 '-]{0,59}$/;
const portfolioFontSelectionSchema = z.custom<PortfolioFontSelection>(
  (value) => isPortfolioFontKey(value) || (typeof value === "string" && GOOGLE_FONT_SELECTION_RE.test(value)),
  { message: "Invalid font selection" }
);

// ---------------------------------------------------------------------------
// brandKitSchema
// ---------------------------------------------------------------------------

export const brandKitSchema = z.object({
  themePreset: z.enum(BRAND_KIT_THEME_PRESETS),
  // Legacy pairing kept for back-compat; new saves also carry independent fonts.
  fontPair: z.enum(BRAND_KIT_FONT_PAIRS),
  headingFont: portfolioFontSelectionSchema.optional(),
  bodyFont: portfolioFontSelectionSchema.optional(),
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
// portfolioCollectionsPopupConfigSchema
//
// Workspace-wide style config for the collections popup surface.
// All fields optional → falls back to brand-kit values.
// ---------------------------------------------------------------------------

export const portfolioCollectionsPopupConfigSchema = z.object({
  backgroundColor: z.string().max(32).optional().or(z.literal("")),
  borderColor: z.string().max(32).optional().or(z.literal("")),
  borderWidth: z.number().int().min(0).max(12).optional(),
  radius: z.enum(BRAND_KIT_RADII).optional().or(z.literal("")),
  // Title styling
  titleText: z.string().optional(),
  titleFontFamily: z.enum(PORTFOLIO_FONT_KEYS).optional().or(z.literal("")),
  titleFontSize: z.number().optional(),
  titleColorToken: z.string().optional(),
  titleBold: z.boolean().optional(),
  titleItalic: z.boolean().optional(),
  titleUnderline: z.boolean().optional(),
  titleAlign: z.enum(["left", "center", "right"]).optional().or(z.literal("")),
  // Close button styling
  closeButtonSize: z.number().optional(),
  closeButtonRadius: z.enum(BRAND_KIT_RADII).optional().or(z.literal("")),
  closeButtonBorderWidth: z.number().optional(),
  closeButtonBorderColorToken: z.string().optional(),
  closeButtonOpacity: z.number().optional(),
  closeButtonBgColorToken: z.string().optional(),
});
export type PortfolioCollectionsPopupConfigInput = z.infer<typeof portfolioCollectionsPopupConfigSchema>;

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
  buttonColor: z.string().max(32).optional().or(z.literal("")),
  buttonTextColor: z.string().max(32).optional().or(z.literal("")),
  errorMessageColor: z.string().max(32).optional().or(z.literal("")),
  buttonRadius: z.enum(BRAND_KIT_RADII).optional().or(z.literal("")),
  buttonBorderColor: z.string().max(32).optional().or(z.literal("")),
  buttonBorderWidth: z.number().int().min(0).max(12).optional(),
  addSessionButtonStyle: z.enum(BRAND_KIT_BUTTON_STYLES).optional().or(z.literal("")),
  addSessionButtonColor: z.string().max(32).optional().or(z.literal("")),
  addSessionButtonTextColor: z.string().max(32).optional().or(z.literal("")),
  addSessionButtonRadius: z.enum(BRAND_KIT_RADII).optional().or(z.literal("")),
  addSessionButtonBorderColor: z.string().max(32).optional().or(z.literal("")),
  addSessionButtonBorderWidth: z.number().int().min(0).max(12).optional(),
  backgroundColor: z.string().max(32).optional().or(z.literal("")),
  textColor: z.string().max(32).optional().or(z.literal("")),
  popupRadius: z.enum(BRAND_KIT_RADII).optional().or(z.literal("")),
  popupBorderColor: z.string().max(32).optional().or(z.literal("")),
  popupBorderWidth: z.number().int().min(0).max(12).optional(),
  popupStyle: z.enum(BRAND_KIT_BUTTON_STYLES).optional().or(z.literal("")),
  // Tab styling — mirrors header link/active-link conventions
  tabFontSize: z.enum(HEADER_FONT_SIZES).optional().or(z.literal("")),
  tabColor: z.string().max(32).optional().or(z.literal("")),
  activeTabColor: z.string().max(32).optional().or(z.literal("")),
  activeTabScale: z.boolean().optional(),
  activeTabHighlight: z.boolean().optional(),
  tabHighlightColor: z.string().max(32).optional().or(z.literal("")),
  tabHighlightOpacity: z.number().int().min(0).max(100).optional(),
  activeTabRadius: z.enum(BRAND_KIT_RADII).optional().or(z.literal("")),
  activeTabUnderline: z.boolean().optional(),
  tabUnderlineColor: z.string().max(32).optional().or(z.literal("")),
});

export type PortfolioContactConfigInput = z.infer<typeof portfolioContactConfigSchema>;

// ---------------------------------------------------------------------------
// portfolioHeaderConfigSchema
// ---------------------------------------------------------------------------

export const portfolioHeaderConfigSchema = z.object({
  brandText: z.string().trim().max(80).optional().or(z.literal("")),
  logoUrl: z.string().max(500).optional().or(z.literal("")),
  logoAssetId: z.string().max(200).optional().or(z.literal("")),
  backgroundColor: z.string().max(32).optional().or(z.literal("")),
  backgroundOpacity: z.number().int().min(0).max(100).optional(),
  linkColor: z.string().max(32).optional().or(z.literal("")),
  brandTextColor: z.string().max(32).optional().or(z.literal("")),
  activeLinkColor: z.string().max(32).optional().or(z.literal("")),
  borderBottomWidth: z.number().int().min(0).max(8).optional(),
  borderBottomColor: z.string().max(32).optional().or(z.literal("")),
  shadowSize: z.enum(HEADER_SHADOW_SIZES).optional().or(z.literal("")),
  fontSize: z.enum(HEADER_FONT_SIZES).optional().or(z.literal("")),
  navbarSize: z.enum(HEADER_NAVBAR_SIZES).optional().or(z.literal("")),
  activeLinkScale: z.boolean().optional(),
  activeLinkHighlight: z.boolean().optional(),
  highlightColor: z.string().max(32).optional().or(z.literal("")),
  highlightOpacity: z.number().int().min(0).max(100).optional(),
  activeLinkRadius: z.enum(BRAND_KIT_RADII).optional().or(z.literal("")),
  activeLinkUnderline: z.boolean().optional(),
  underlineColor: z.string().max(32).optional().or(z.literal("")),
  contactButtonColor: z.string().max(32).optional().or(z.literal("")),
  contactButtonTextColor: z.string().max(32).optional().or(z.literal("")),
  contactButtonOpacity: z.number().int().min(0).max(100).optional(),
  contactButtonRadius: z.enum(BRAND_KIT_RADII).optional().or(z.literal("")),
});

export type PortfolioHeaderConfigInput = z.infer<typeof portfolioHeaderConfigSchema>;

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

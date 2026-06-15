import { z } from "zod";

export const slugSchema = z
  .string()
  .min(3, "At least 3 characters")
  .max(50, "At most 50 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only");

export const BUSINESS_TYPE_VALUES = [
  "photographer",
  "venue",
  "planner",
  "stylist",
  "catering",
  "entertainer",
  "other",
] as const;

// Paddle-supported merchant markets. PH leads because that's Gallurio's MVP
// launch market. SEA markets map to their primary language; en-only markets
// (AU/CA/NZ/UK/US/SG) stay on English; Gulf markets fall back to English
// until the Arabic locale ships — see lib/i18n/localeForCountry.ts.
// Gulf currencies KWD/BHD/OMR are 3-decimal currencies.
export const BILLING_COUNTRY_VALUES = [
  "PH",
  "SG",
  "MY",
  "ID",
  "TH",
  "AU",
  "CA",
  "NZ",
  "GB",
  "US",
  "AE",
  "SA",
  "QA",
  "KW",
  "OM",
  "BH",
] as const;
export type SupportedCountry = (typeof BILLING_COUNTRY_VALUES)[number];

export const SUPPORTED_CURRENCIES = [
  "PHP",
  "SGD",
  "MYR",
  "IDR",
  "THB",
  "AUD",
  "CAD",
  "NZD",
  "GBP",
  "USD",
  "AED",
  "SAR",
  "QAR",
  "KWD",
  "OMR",
  "BHD",
] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const COUNTRY_TO_CURRENCY: Record<SupportedCountry, SupportedCurrency> = {
  PH: "PHP",
  SG: "SGD",
  MY: "MYR",
  ID: "IDR",
  TH: "THB",
  AU: "AUD",
  CA: "CAD",
  NZ: "NZD",
  GB: "GBP",
  US: "USD",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  OM: "OMR",
  BH: "BHD",
};

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex like #1a1a1a");

export const businessStepSchema = z.object({
  firstName: z.string().min(1, "Required").max(40, "At most 40 characters").trim(),
  lastName: z.string().max(40, "At most 40 characters").trim().optional().default(""),
  name: z.string().min(2, "At least 2 characters").max(80, "At most 80 characters").trim(),
  slug: slugSchema,
  businessType: z.enum(BUSINESS_TYPE_VALUES),
  country: z.enum(BILLING_COUNTRY_VALUES, {
    errorMap: () => ({ message: "Pick a supported country" }),
  }),
  currency: z.enum(SUPPORTED_CURRENCIES, {
    errorMap: () => ({ message: "Pick a supported currency" }),
  }),
  timezone: z.string().min(1, "Pick a timezone"),
});
export type BusinessStepInput = z.infer<typeof businessStepSchema>;

export const brandingStepSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  logoAssetId: z.string().nullable().optional(),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  tagline: z.string().max(120, "Keep it under 120 characters").optional().default(""),
  description: z.string().max(500, "Keep it under 500 characters").optional().default(""),
});
export type BrandingStepInput = z.infer<typeof brandingStepSchema>;

// Kept for backwards-compat with the old single-page onboarding action signature.
export const createWorkspaceSchema = z.object({
  name: businessStepSchema.shape.name,
  slug: businessStepSchema.shape.slug,
  businessType: businessStepSchema.shape.businessType,
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

// ---- Post-onboarding settings ---------------------------------------------
// Business + branding fields the owner can change from /settings/workspace.
// Mirrors the onboarding schemas so validation stays consistent.
export const updateWorkspaceBusinessSchema = z.object({
  name: businessStepSchema.shape.name,
  slug: businessStepSchema.shape.slug,
  businessType: businessStepSchema.shape.businessType,
  country: businessStepSchema.shape.country,
  currency: businessStepSchema.shape.currency,
  timezone: businessStepSchema.shape.timezone,
});
export type UpdateWorkspaceBusinessInput = z.infer<typeof updateWorkspaceBusinessSchema>;

export const updateWorkspaceBrandingSchema = brandingStepSchema;
export type UpdateWorkspaceBrandingInput = z.infer<typeof updateWorkspaceBrandingSchema>;

// Public-page settings (SEO + inquiry email). Visibility is a separate toggle
// action so the form here covers free-text fields only.
export const publicPageSettingsSchema = z.object({
  seoTitle: z.string().max(70, "Keep it under 70 characters").trim().optional().default(""),
  seoDescription: z
    .string()
    .max(160, "Keep it under 160 characters")
    .trim()
    .optional()
    .default(""),
  inquiryRecipientEmail: z
    .union([z.string().email("Enter a valid email"), z.literal("")])
    .optional()
    .default(""),
});
export type PublicPageSettingsInput = z.infer<typeof publicPageSettingsSchema>;

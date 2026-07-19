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

// Lemon Squeezy-supported merchant markets. PH leads because that's Gallurio's MVP
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

// Step 1 — business identity only. The workspace URL (slug) and
// country/timezone/currency live on workspaceSetupSchema (a later onboarding
// step); this schema is also reused by the post-onboarding settings form below.
export const businessStepSchema = z.object({
  firstName: z.string().min(1, "Required").max(40, "At most 40 characters").trim(),
  lastName: z.string().max(40, "At most 40 characters").trim().optional().default(""),
  name: z.string().min(2, "At least 2 characters").max(80, "At most 80 characters").trim(),
  businessType: z.enum(BUSINESS_TYPE_VALUES),
});
export type BusinessStepInput = z.infer<typeof businessStepSchema>;

// Step 2 — workspace setup (URL slug, country, timezone, time-format
// preference). No `currency` field: it is never client-submitted, only
// derived server-side from `country` via COUNTRY_TO_CURRENCY.
export const workspaceSetupSchema = z.object({
  slug: slugSchema,
  country: z.enum(BILLING_COUNTRY_VALUES, {
    errorMap: () => ({ message: "Pick a supported country" }),
  }),
  timezone: z.string().min(1, "Pick a timezone"),
  timeFormat: z.enum(["24h", "12h"]),
});
export type WorkspaceSetupInput = z.infer<typeof workspaceSetupSchema>;

// Standalone currency schema — used by updateWorkspaceBusinessSchema (settings,
// which still exposes a manual currency override) independently of either
// onboarding step schema.
export const currencySchema = z.enum(SUPPORTED_CURRENCIES, {
  errorMap: () => ({ message: "Pick a supported currency" }),
});

// Shared coercion helper for a possibly-null/invalid stored country value.
export function coerceBillingCountry(
  value: string | null | undefined,
  fallback: SupportedCountry = "PH"
): SupportedCountry {
  return (BILLING_COUNTRY_VALUES as readonly string[]).includes(value ?? "")
    ? (value as SupportedCountry)
    : fallback;
}

// Kept for backwards-compat with the old single-page onboarding action signature.
export const createWorkspaceSchema = z.object({
  name: businessStepSchema.shape.name,
  slug: workspaceSetupSchema.shape.slug,
  businessType: businessStepSchema.shape.businessType,
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

// ---- Post-onboarding settings ---------------------------------------------
// Business fields the owner can change from /settings/workspace.
export const updateWorkspaceBusinessSchema = z.object({
  name: businessStepSchema.shape.name,
  slug: workspaceSetupSchema.shape.slug,
  businessType: businessStepSchema.shape.businessType,
  country: workspaceSetupSchema.shape.country,
  currency: currencySchema,
  timezone: workspaceSetupSchema.shape.timezone,
  contactEmail: z.union([z.string().email("Enter a valid email"), z.literal("")]).optional().default(""),
  contactAddress: z.string().max(200).trim().optional().default(""),
  contactAddressLat: z.number().min(-90).max(90).nullable().optional(),
  contactAddressLng: z.number().min(-180).max(180).nullable().optional(),
  logoUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
  logoAssetId: z.string().trim().optional().default(""),
});
export type UpdateWorkspaceBusinessInput = z.infer<typeof updateWorkspaceBusinessSchema>;

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
  logoUrl: z.string().max(500).trim().url().or(z.literal("")).optional().default(""),
  logoAssetId: z.string().max(200).trim().optional().default(""),
  siteIconUrl: z
    .string()
    .trim()
    .url()
    .or(z.literal(""))
    .optional()
    .default(""),
  siteIconAssetId: z.string().trim().optional().default(""),
  seo: z
    .object({
      keywords: z
        .array(
          z
            .string()
            .trim()
            .min(1, "Each SEO tag must contain text")
            .max(40, "Keep each SEO tag under 40 characters")
        )
        .max(10, "Add up to 10 SEO tags")
        .optional()
        .default([]),
      ogImageUrl: z.string().trim().url().or(z.literal("")).optional().default(""),
      ogImageAssetId: z.string().trim().optional().default(""),
      galleryDescription: z
        .string()
        .max(160, "Keep it under 160 characters")
        .trim()
        .optional()
        .default(""),
      noindex: z.boolean().optional().default(false),
    })
    .optional(),
});
export type PublicPageSettingsInput = z.infer<typeof publicPageSettingsSchema>;
// Raw (pre-default) input type — use as the function parameter type so all
// fields are optional (the schema applies defaults during parse).
export type PublicPageSettingsRawInput = z.input<typeof publicPageSettingsSchema>;

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

// HitPay's supported merchant markets (sandbox + live).
// Source: https://hitpay.zendesk.com/hc/en-us/articles/18100524521241
// PH leads because that's Gallurio's MVP launch market. en-only markets
// (AU/CA/NZ/UK/US) get the English locale; SEA markets get their primary
// language — see lib/i18n/localeForCountry.ts.
export const HITPAY_COUNTRY_VALUES = [
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
] as const;
export type HitpayCountry = (typeof HITPAY_COUNTRY_VALUES)[number];

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex like #1a1a1a");

export const businessStepSchema = z.object({
  firstName: z.string().min(1, "Required").max(40, "At most 40 characters").trim(),
  lastName: z.string().max(40, "At most 40 characters").trim().optional().default(""),
  name: z.string().min(2, "At least 2 characters").max(80, "At most 80 characters").trim(),
  slug: slugSchema,
  businessType: z.enum(BUSINESS_TYPE_VALUES),
  country: z.enum(HITPAY_COUNTRY_VALUES, {
    errorMap: () => ({ message: "Pick a country where HitPay operates" }),
  }),
  timezone: z.string().min(1, "Pick a timezone"),
});
export type BusinessStepInput = z.infer<typeof businessStepSchema>;

export const brandingStepSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  logoCloudinaryPublicId: z.string().nullable().optional(),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  tagline: z.string().max(120, "Keep it under 120 characters").optional().default(""),
  description: z.string().max(500, "Keep it under 500 characters").optional().default(""),
});
export type BrandingStepInput = z.infer<typeof brandingStepSchema>;

export const templateStepSchema = z.object({
  templateId: z.enum(["default", "editorial", "studio"]),
});
export type TemplateStepInput = z.infer<typeof templateStepSchema>;

// Kept for backwards-compat with the old single-page onboarding action signature.
export const createWorkspaceSchema = z.object({
  name: businessStepSchema.shape.name,
  slug: businessStepSchema.shape.slug,
  businessType: businessStepSchema.shape.businessType,
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

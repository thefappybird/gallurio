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

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex like #1a1a1a");

export const businessStepSchema = z.object({
  firstName: z.string().min(1, "Required").max(40, "At most 40 characters").trim(),
  lastName: z.string().max(40, "At most 40 characters").trim().optional().default(""),
  name: z.string().min(2, "At least 2 characters").max(80, "At most 80 characters").trim(),
  slug: slugSchema,
  businessType: z.enum(BUSINESS_TYPE_VALUES),
  country: z.string().min(2, "Pick a country").max(2, "Use a 2-letter country code"),
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

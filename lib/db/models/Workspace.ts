import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { SUPPORTED_CURRENCIES } from "@/lib/validators/workspace";
import {
  BRAND_KIT_THEME_PRESETS,
  BRAND_KIT_FONT_PAIRS,
  BRAND_KIT_RADII,
  BRAND_KIT_BUTTON_STYLES,
  CONTACT_BUTTON_COLORS,
} from "@/lib/page-builder/types";

export const PLAN_TIERS = ["free", "starter", "pro"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const PUBLIC_PAGE_TEMPLATES = ["default", "editorial", "studio"] as const;
export type PublicPageTemplate = (typeof PUBLIC_PAGE_TEMPLATES)[number];

export const PADDLE_SUBSCRIPTION_STATUSES = [
  "active",
  "canceled",
  "past_due",
  "paused",
  "trialing",
] as const;
export type PaddleSubscriptionStatus = (typeof PADDLE_SUBSCRIPTION_STATUSES)[number];

const workspaceSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    ownerUserId: { type: String, required: true, index: true },
    clerkOrgId: { type: String, required: true, unique: true, index: true },
    businessType: {
      type: String,
      enum: ["photographer", "venue", "planner", "stylist", "catering", "entertainer", "other"],
      default: "other",
    },
    // ISO 3166-1 alpha-2. Drives the locale of the public workspace page —
    // see lib/i18n/localeForCountry.ts.
    country: { type: String, default: null },
    currency: { type: String, enum: SUPPORTED_CURRENCIES, default: "PHP", required: true },
    timezone: { type: String, default: null },
    branding: {
      logoUrl: { type: String, default: null },
      logoCloudinaryPublicId: { type: String, default: null },
      primaryColor: { type: String, default: "#111111" },
      secondaryColor: { type: String, default: "#f5f5f5" },
      tagline: { type: String, default: "" },
      description: { type: String, default: "" },
    },
    contact: {
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      socials: {
        instagram: { type: String, default: "" },
        facebook: { type: String, default: "" },
        tiktok: { type: String, default: "" },
        website: { type: String, default: "" },
      },
    },
    publicPage: {
      templateId: { type: String, enum: PUBLIC_PAGE_TEMPLATES, default: "default" },
      data: {
        home: { type: Schema.Types.Mixed, default: null },
        gallery: { type: Schema.Types.Mixed, default: null },
      },
      brandKit: {
        themePreset: { type: String, enum: BRAND_KIT_THEME_PRESETS, default: "minimal" },
        fontPair: { type: String, enum: BRAND_KIT_FONT_PAIRS, default: "merriweather-only" },
        primaryColor: { type: String, default: "#111111" },
        secondaryColor: { type: String, default: "#f5f5f5" },
        accentColor: { type: String, default: "#2f5d56" },
        backgroundColor: { type: String, default: "#ffffff" },
        foregroundColor: { type: String, default: "#111111" },
        radius: { type: String, enum: BRAND_KIT_RADII, default: "sharp" },
        buttonStyle: { type: String, enum: BRAND_KIT_BUTTON_STYLES, default: "solid" },
      },
      publishedAt: { type: Date, default: null },
      // Publish bookkeeping — written by the publish action.
      lastPublishedAt: { type: Date, default: null },
      latestVersion: { type: Number, default: 0 },
      seoTitle: { type: String, default: "" },
      seoDescription: { type: String, default: "" },
      inquiryRecipientEmail: { type: String, default: "" },
      // Customizable chrome for the prebuilt contact modal. The form fields are
      // fixed; only this copy + button presentation can be edited. Editing UI
      // lands with the page-builder editor (Phase 9); seeded defaults in Phase 8.
      contact: {
        title: { type: String, default: "" },
        description: { type: String, default: "" },
        buttonStyle: { type: String, enum: [...BRAND_KIT_BUTTON_STYLES, ""], default: "" },
        buttonColor: { type: String, enum: [...CONTACT_BUTTON_COLORS, ""], default: "" },
      },
    },
    customDomain: { type: String, default: null },
    plan: { type: String, enum: PLAN_TIERS, default: "free", index: true },

    // Paddle subscription — Gallurio billing the tenant (Merchant of Record).
    paddleSubscriptionId: { type: String, default: null, index: true, sparse: true },
    paddleCustomerId: { type: String, default: null, index: true, sparse: true },
    paddleSubscriptionStatus: {
      type: String,
      enum: [...PADDLE_SUBSCRIPTION_STATUSES, null],
      default: null,
    },
    paddleCurrentPeriodEnd: { type: Date, default: null },
    // In-flight durable checkout workflow run id; cleared on activation.
    paddleCheckoutWorkflowRunId: { type: String, default: null },

    trialEndsAt: { type: Date, default: null },
    onboardingCompletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type WorkspaceDoc = InferSchemaType<typeof workspaceSchema> & { _id: mongoose.Types.ObjectId };

export const Workspace: Model<WorkspaceDoc> =
  (mongoose.models.Workspace as Model<WorkspaceDoc>) ??
  mongoose.model<WorkspaceDoc>("Workspace", workspaceSchema);

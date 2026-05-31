import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { SUPPORTED_CURRENCIES } from "@/lib/validators/workspace";
import {
  BRAND_KIT_THEME_PRESETS,
  BRAND_KIT_FONT_PAIRS,
  BRAND_KIT_RADII,
  BRAND_KIT_BUTTON_STYLES,
  CONTACT_BUTTON_COLORS,
} from "@/lib/page-builder/types";
import { PORTFOLIO_TEMPLATE_IDS } from "@/lib/page-builder/templates/types";

export const PLAN_TIERS = ["free", "starter", "pro"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

// The portfolio template the workspace was seeded from. Canonical ids live in
// the template registry so adding a template there makes it persistable here.
export const PUBLIC_PAGE_TEMPLATES = PORTFOLIO_TEMPLATE_IDS;
export type PublicPageTemplate = (typeof PUBLIC_PAGE_TEMPLATES)[number];

// HitPay recurring statuses we care about. HitPay's API documents:
// scheduled / active / cancelled / completed / closed / failed.
// We map them to a compact internal set; `pending` covers the "redirected
// but not yet captured" window where the user has opened the HitPay page
// but not finished authorization.
export const HITPAY_RECURRING_STATUSES = [
  "pending",
  "active",
  "cancelled",
  "completed",
  "closed",
  "failed",
] as const;
export type HitpayRecurringStatus = (typeof HITPAY_RECURRING_STATUSES)[number];

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
      templateId: { type: String, enum: PUBLIC_PAGE_TEMPLATES, default: "minimal" },
      data: {
        home: { type: Schema.Types.Mixed, default: null },
        gallery: { type: Schema.Types.Mixed, default: null },
      },
      // Soft-archive of the previous {home,gallery} data, written by the wizard
      // reset flow before it overwrites — so an accidental reset is recoverable.
      previousData: {
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
      // Per-page language for the Gallurio chrome (inquiry form, nav, footer,
      // gallery labels) on the public portfolio — isolated from the owner's own
      // app locale. "" → fall back to the locale derived from workspace.country.
      formLocale: { type: String, enum: ["en", "fil", "ms", "id", "th", ""], default: "" },
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

    // --- HitPay subscription (Gallurio billing the tenant) -------------------
    // HitPay does not maintain a separate "customer" object the way Stripe or
    // Xendit do — recurring-billing rows carry the customer email directly.
    // So we store only the recurring-billing id and our own reference.
    hitpayRecurringBillingId: { type: String, default: null, index: true, sparse: true },
    hitpayRecurringReference: { type: String, default: null },
    hitpayRecurringStatus: {
      type: String,
      enum: [...HITPAY_RECURRING_STATUSES, null],
      default: null,
    },
    hitpayCurrentPeriodEnd: { type: Date, default: null },

    trialEndsAt: { type: Date, default: null },
    onboardingCompletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type WorkspaceDoc = InferSchemaType<typeof workspaceSchema> & { _id: mongoose.Types.ObjectId };

export const Workspace: Model<WorkspaceDoc> =
  (mongoose.models.Workspace as Model<WorkspaceDoc>) ??
  mongoose.model<WorkspaceDoc>("Workspace", workspaceSchema);

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { SUPPORTED_CURRENCIES } from "@/lib/validators/workspace";
import {
  BRAND_KIT_THEME_PRESETS,
  BRAND_KIT_FONT_PAIRS,
  BRAND_KIT_RADII,
  BRAND_KIT_BUTTON_STYLES,
  SAVED_THEMES_MAX,
  HEADER_SHADOW_SIZES,
  HEADER_FONT_SIZES,
} from "@/lib/page-builder/types";
import { PORTFOLIO_FONT_KEYS } from "@/lib/page-builder/fonts";
import { PORTFOLIO_TEMPLATE_IDS } from "@/lib/page-builder/templates/types";

export const PLAN_TIERS = ["free", "starter", "pro"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

// The portfolio template the workspace was seeded from. Canonical ids live in
// the template registry so adding a template there makes it persistable here.
export const PUBLIC_PAGE_TEMPLATES = PORTFOLIO_TEMPLATE_IDS;
export type PublicPageTemplate = (typeof PUBLIC_PAGE_TEMPLATES)[number];

export const PADDLE_SUBSCRIPTION_STATUSES = [
  "active",
  "canceled",
  "past_due",
  "paused",
  "trialing",
] as const;
export type PaddleSubscriptionStatus = (typeof PADDLE_SUBSCRIPTION_STATUSES)[number];

// Brand-kit field definition, reused for `publicPage.brandKit` and each entry
// in `publicPage.savedThemes`. `fontPair` stays for back-compat; `headingFont`
// / `bodyFont` are the new independent-family selectors.
const brandKitFields = {
  themePreset: { type: String, enum: BRAND_KIT_THEME_PRESETS, default: "minimal" },
  fontPair: { type: String, enum: BRAND_KIT_FONT_PAIRS, default: "merriweather-only" },
  headingFont: { type: String, enum: PORTFOLIO_FONT_KEYS, default: "merriweather" },
  bodyFont: { type: String, enum: PORTFOLIO_FONT_KEYS, default: "merriweather" },
  primaryColor: { type: String, default: "#111111" },
  secondaryColor: { type: String, default: "#f5f5f5" },
  accentColor: { type: String, default: "#2f5d56" },
  backgroundColor: { type: String, default: "#ffffff" },
  foregroundColor: { type: String, default: "#111111" },
  radius: { type: String, enum: BRAND_KIT_RADII, default: "sharp" },
  buttonStyle: { type: String, enum: BRAND_KIT_BUTTON_STYLES, default: "solid" },
} as const;

const workspaceSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    ownerUserId: { type: String, required: true, index: true },
    businessType: {
      type: String,
      enum: ["photographer", "venue", "planner", "stylist", "catering", "entertainer", "other"],
      default: "other",
    },
    // ISO 3166-1 alpha-2. Used for billing/market defaults. NOTE: it no longer
    // drives the public page language — that is owner-chosen via
    // publicPage.formLocale (default English). See resolvePublicChromeLocale.
    country: { type: String, default: null },
    currency: { type: String, enum: SUPPORTED_CURRENCIES, default: "PHP", required: true },
    timezone: { type: String, default: null },
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
      brandKit: brandKitFields,
      // Owner's named, reusable brand kits (apply/save/delete in the Theme
      // panel). Embedded — NOT a separate collection — per the portfolio-maker
      // "no new collections" rule. `_id: false` keeps our own `id` authoritative.
      savedThemes: {
        type: [
          new Schema(
            {
              id: { type: String, required: true },
              name: { type: String, required: true, trim: true },
              brandKit: brandKitFields,
            },
            { _id: false }
          ),
        ],
        default: [],
        validate: {
          validator: (v: unknown[]) => !Array.isArray(v) || v.length <= SAVED_THEMES_MAX,
          message: `A workspace can store at most ${SAVED_THEMES_MAX} saved themes.`,
        },
      },
      publishedAt: { type: Date, default: null },
      // Publish bookkeeping — written by the publish action.
      lastPublishedAt: { type: Date, default: null },
      latestVersion: { type: Number, default: 0 },
      // When the owner dismissed the editor's first-run guide overlay ("don't
      // show again"). Null → the guide auto-opens on load. Stored per workspace
      // (one owner per workspace in MVP) so the choice survives across devices.
      guideDismissedAt: { type: Date, default: null },
      seoTitle: { type: String, default: "" },
      seoDescription: { type: String, default: "" },
      inquiryRecipientEmail: { type: String, default: "" },
      // Per-page language for the Gallurio chrome (inquiry form, nav, footer,
      // gallery labels) on the public portfolio — isolated from the owner's own
      // app locale. "" → fall back to the locale derived from workspace.country.
      formLocale: { type: String, enum: ["en", "fil", "ms", "id", ""], default: "" },
      // Customizable chrome for the prebuilt contact modal. The form fields are
      // fixed; only this copy + button presentation can be edited. Editing UI
      // lands with the page-builder editor (Phase 9); seeded defaults in Phase 8.
      contact: {
        title: { type: String, default: "" },
        description: { type: String, default: "" },
        buttonStyle: { type: String, enum: [...BRAND_KIT_BUTTON_STYLES, ""], default: "" },
        buttonColor: { type: String, default: "" },
        buttonTextColor: { type: String, default: "" },
        errorMessageColor: { type: String, default: "" },
        buttonRadius: { type: String, enum: [...BRAND_KIT_RADII, ""], default: "" },
        buttonBorderColor: { type: String, default: "" },
        buttonBorderWidth: { type: Number, default: 0 },
        addSessionButtonStyle: { type: String, enum: [...BRAND_KIT_BUTTON_STYLES, ""], default: "" },
        addSessionButtonColor: { type: String, default: "" },
        addSessionButtonTextColor: { type: String, default: "" },
        addSessionButtonRadius: { type: String, enum: [...BRAND_KIT_RADII, ""], default: "" },
        addSessionButtonBorderColor: { type: String, default: "" },
        addSessionButtonBorderWidth: { type: Number, default: 0 },
        backgroundColor: { type: String, default: "" },
        textColor: { type: String, default: "" },
        popupRadius: { type: String, enum: [...BRAND_KIT_RADII, ""], default: "" },
        popupBorderColor: { type: String, default: "" },
        popupBorderWidth: { type: Number, default: 0 },
        popupStyle: { type: String, enum: [...BRAND_KIT_BUTTON_STYLES, ""], default: "" },
        // Tab styling
        tabFontSize: { type: String, enum: [...HEADER_FONT_SIZES, ""], default: "" },
        tabColor: { type: String, default: "" },
        activeTabColor: { type: String, default: "" },
        activeTabScale: { type: Boolean, default: false },
        activeTabHighlight: { type: Boolean, default: false },
        tabHighlightColor: { type: String, default: "" },
        tabHighlightOpacity: { type: Number, default: 100 },
        activeTabRadius: { type: String, enum: [...BRAND_KIT_RADII, ""], default: "" },
        activeTabUnderline: { type: Boolean, default: false },
        tabUnderlineColor: { type: String, default: "" },
      },
      // Configurable chrome for the collections popup surface.
      // All fields optional — popup falls back to brand-kit values.
      collectionsPopup: {
        backgroundColor: { type: String, default: "" },
        borderColor: { type: String, default: "" },
        borderWidth: { type: Number, default: 0 },
        radius: { type: String, enum: [...BRAND_KIT_RADII, ""], default: "" },
        // Title styling
        titleText: { type: String, default: "" },
        titleFontFamily: { type: String, enum: [...PORTFOLIO_FONT_KEYS, ""], default: "" },
        titleFontSize: { type: Number, default: 0 },
        titleColorToken: { type: String, default: "" },
        titleBold: { type: Boolean, default: false },
        titleItalic: { type: Boolean, default: false },
        titleUnderline: { type: Boolean, default: false },
        titleAlign: { type: String, enum: ["left", "center", "right", ""], default: "" },
        // Close button styling
        closeButtonSize: { type: Number, default: 0 },
        closeButtonRadius: { type: String, enum: [...BRAND_KIT_RADII, ""], default: "" },
        closeButtonBorderWidth: { type: Number, default: 0 },
        closeButtonBorderColorToken: { type: String, default: "" },
        closeButtonOpacity: { type: Number, default: 0 },
        closeButtonBgColorToken: { type: String, default: "" },
      },
      // Configurable chrome for the public portfolio navigation header.
      // All fields optional — header falls back to brand-kit values.
      header: {
        brandText: { type: String },
        logoUrl: { type: String, default: "" },
        logoAssetId: { type: String, default: "" },
        backgroundColor: { type: String, default: "" },
        backgroundOpacity: { type: Number, default: 100 },
        linkColor: { type: String, default: "" },
        activeLinkColor: { type: String, default: "" },
        borderBottomWidth: { type: Number, default: 0 },
        borderBottomColor: { type: String, default: "" },
        shadowSize: { type: String, enum: [...HEADER_SHADOW_SIZES, ""], default: "" },
        fontSize: { type: String, enum: [...HEADER_FONT_SIZES, ""], default: "" },
        activeLinkScale: { type: Boolean, default: false },
        activeLinkHighlight: { type: Boolean, default: false },
        highlightColor: { type: String, default: "" },
        highlightOpacity: { type: Number, default: 100 },
        activeLinkRadius: { type: String, enum: [...BRAND_KIT_RADII, ""], default: "" },
        activeLinkUnderline: { type: Boolean, default: false },
        underlineColor: { type: String, default: "" },
        contactButtonColor: { type: String, default: "" },
        contactButtonTextColor: { type: String, default: "" },
        contactButtonOpacity: { type: Number, default: 100 },
        contactButtonRadius: { type: String, enum: [...BRAND_KIT_RADII, ""], default: "" },
      },
      siteIcon: {
        url: { type: String, default: "" },
        assetId: { type: String, default: "" },
      },
      // SEO sub-object for owner-configurable social/crawl controls.
      // All fields default to empty/false so existing docs without `seo`
      // read fine (Mongoose applies the defaults on access).
      seo: {
        ogImageUrl: { type: String, default: "" },
        ogImageAssetId: { type: String, default: "" },
        galleryDescription: { type: String, default: "" },
        noindex: { type: Boolean, default: false },
      },
    },
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

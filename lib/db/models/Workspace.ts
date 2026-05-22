import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const publicPageBlockSchema = new Schema(
  {
    type: { type: String, required: true },
    props: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

export const PLAN_TIERS = ["free", "starter", "pro"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const PUBLIC_PAGE_TEMPLATES = ["default", "editorial", "studio"] as const;
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
    timezone: { type: String, default: null },
    branding: {
      logoUrl: { type: String, default: null },
      logoCloudinaryPublicId: { type: String, default: null },
      primaryColor: { type: String, default: "#111111" },
      secondaryColor: { type: String, default: "#f5f5f5" },
      tagline: { type: String, default: "" },
      description: { type: String, default: "" },
    },
    publicPage: {
      templateId: { type: String, enum: PUBLIC_PAGE_TEMPLATES, default: "default" },
      data: { type: Schema.Types.Mixed, default: null },
      blocks: { type: [publicPageBlockSchema], default: [] },
      publishedAt: { type: Date, default: null },
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

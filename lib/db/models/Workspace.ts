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
    customDomain: { type: String, default: null, sparse: true, unique: true },
    plan: { type: String, enum: PLAN_TIERS, default: "free", index: true },
    stripeCustomerId: { type: String, default: null, index: true, sparse: true },
    stripeSubscriptionId: { type: String, default: null, index: true, sparse: true },
    stripePriceId: { type: String, default: null },
    stripeCurrentPeriodEnd: { type: Date, default: null },
    stripeStatus: {
      type: String,
      enum: ["active", "trialing", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", null],
      default: null,
    },
    stripeConnectAccountId: { type: String, default: null, sparse: true, index: true },
    stripeConnectChargesEnabled: { type: Boolean, default: false },
    stripeConnectPayoutsEnabled: { type: Boolean, default: false },
    stripeConnectDetailsSubmitted: { type: Boolean, default: false },
    trialEndsAt: { type: Date, default: null },
    onboardingCompletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type WorkspaceDoc = InferSchemaType<typeof workspaceSchema> & { _id: mongoose.Types.ObjectId };

export const Workspace: Model<WorkspaceDoc> =
  (mongoose.models.Workspace as Model<WorkspaceDoc>) ??
  mongoose.model<WorkspaceDoc>("Workspace", workspaceSchema);

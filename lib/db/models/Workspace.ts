import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const publicPageBlockSchema = new Schema(
  {
    type: { type: String, required: true },
    props: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

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
    branding: {
      logoUrl: { type: String, default: null },
      primaryColor: { type: String, default: "#111111" },
    },
    publicPage: {
      templateId: { type: String, default: "default" },
      blocks: { type: [publicPageBlockSchema], default: [] },
      publishedAt: { type: Date, default: null },
    },
    customDomain: { type: String, default: null, sparse: true, unique: true },
    plan: { type: String, enum: ["free", "starter", "pro"], default: "free", index: true },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    trialEndsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type WorkspaceDoc = InferSchemaType<typeof workspaceSchema> & { _id: mongoose.Types.ObjectId };

export const Workspace: Model<WorkspaceDoc> =
  (mongoose.models.Workspace as Model<WorkspaceDoc>) ??
  mongoose.model<WorkspaceDoc>("Workspace", workspaceSchema);

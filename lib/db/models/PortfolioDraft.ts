import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { DRAFT_NAME_MAX } from "@/lib/page-builder/drafts";

// A draft is a full, named portfolio snapshot. Snapshot sub-documents are stored
// as Mixed (like publicPage.data) — the server-action Zod layer validates their
// shape on every write, so the model stays a thin, fast container.
const portfolioDraftSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: DRAFT_NAME_MAX },
    templateId: { type: String, default: "" },
    // Set only on drafts created by importDemoPortfolioAction — no `default`,
    // so ordinary drafts leave the field unset rather than storing null.
    demoSessionId: { type: String },
    data: {
      home: { type: Schema.Types.Mixed, default: null },
      gallery: { type: Schema.Types.Mixed, default: null },
      navigation: { type: Schema.Types.Mixed, default: null },
      footer: { type: Schema.Types.Mixed, default: null },
    },
    brandKit: { type: Schema.Types.Mixed, default: null },
    contact: { type: Schema.Types.Mixed, default: null },
    header: { type: Schema.Types.Mixed, default: null },
    collectionsPopup: { type: Schema.Types.Mixed, default: null },
    formLocale: { type: String, default: "" },
    formDir: { type: String, default: "" },
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
    siteIcon: {
      url: { type: String, default: "" },
      assetId: { type: String, default: "" },
    },
    seo: {
      ogImageUrl: { type: String, default: "" },
      ogImageAssetId: { type: String, default: "" },
      galleryDescription: { type: String, default: "" },
      noindex: { type: Boolean, default: false },
      keywords: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

// Lists the drafts board newest-first, scoped to one tenant.
portfolioDraftSchema.index({ workspaceId: 1, updatedAt: -1 });
// Draft names are unique within a workspace (create + rename). DB-level backstop
// against the check-then-write race in the create/update actions.
portfolioDraftSchema.index({ workspaceId: 1, name: 1 }, { unique: true });
// Makes a demo-portfolio import idempotent per demo session: a retried import
// with the same demoSessionId hits this unique index rather than creating a
// second draft. Partial (not sparse) — a plain sparse compound index still
// indexes every doc because workspaceId is always present, which would collide
// every ordinary draft on demoSessionId: null. $gt: "" also excludes "".
portfolioDraftSchema.index(
  { workspaceId: 1, demoSessionId: 1 },
  { unique: true, partialFilterExpression: { demoSessionId: { $type: "string", $gt: "" } } }
);

export type PortfolioDraftDoc = InferSchemaType<typeof portfolioDraftSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const PortfolioDraft: Model<PortfolioDraftDoc> =
  (mongoose.models.PortfolioDraft as Model<PortfolioDraftDoc>) ??
  mongoose.model<PortfolioDraftDoc>("PortfolioDraft", portfolioDraftSchema);

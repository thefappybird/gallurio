import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Anonymous daily aggregate counters — the only thing the portfolio dashboard
// reads. One doc per (workspaceId, date, page). `page` includes the synthetic
// "_site" bucket holding portfolio-wide totals (views/visitors/inquiries/sources)
// so summing the real per-page docs never double-counts a multi-page visitor.
export const PAGEVIEW_ROLLUP_PAGES = ["home", "gallery", "contact", "_site"] as const;
export type PageviewRollupPage = (typeof PAGEVIEW_ROLLUP_PAGES)[number];

const pageviewRollupSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    // Workspace-local midnight, stored as the UTC instant of that local day.
    date: { type: Date, required: true },
    page: { type: String, enum: PAGEVIEW_ROLLUP_PAGES, required: true },
    views: { type: Number, default: 0 },
    visitors: { type: Number, default: 0 },
    // Set only on the "_site" doc.
    inquiries: { type: Number, default: 0 },
    sources: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

// Upsert target + range reads. Compound index starts with workspaceId (tenancy).
pageviewRollupSchema.index({ workspaceId: 1, date: 1, page: 1 }, { unique: true });
pageviewRollupSchema.index({ workspaceId: 1, date: 1 });

export type PageviewRollupDoc = InferSchemaType<typeof pageviewRollupSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PageviewRollup: Model<PageviewRollupDoc> =
  (mongoose.models.PageviewRollup as Model<PageviewRollupDoc>) ??
  mongoose.model<PageviewRollupDoc>("PageviewRollup", pageviewRollupSchema);

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Ephemeral dedup set backing unique-visitor counting WITHOUT storing pageview
// rows. The unique index makes an insert an atomic test-and-set: insert succeeds
// → first sighting today → bump the rollup's `visitors`; E11000 → already counted
// → skip. The TTL index reaps each marker ~48h later (absorbs clock skew /
// midnight straddle), so the collection stays ~"unique visitors over 2 days".
// No raw IP/UA — only the daily-rotating HMAC.
const pageviewVisitorSeenSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    date: { type: Date, required: true },
    scope: { type: String, required: true }, // "_site" | "home" | "gallery" | "contact"
    visitorHash: { type: String, required: true },
    // ~48h lifetime (absorbs clock skew / UTC-midnight straddle); the TTL index
    // below reaps the marker after this instant. Defaulted so writers don't set it.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  },
  { timestamps: false }
);

pageviewVisitorSeenSchema.index(
  { workspaceId: 1, date: 1, scope: 1, visitorHash: 1 },
  { unique: true }
);
pageviewVisitorSeenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PageviewVisitorSeenDoc = InferSchemaType<typeof pageviewVisitorSeenSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PageviewVisitorSeen: Model<PageviewVisitorSeenDoc> =
  (mongoose.models.PageviewVisitorSeen as Model<PageviewVisitorSeenDoc>) ??
  mongoose.model<PageviewVisitorSeenDoc>(
    "PageviewVisitorSeen",
    pageviewVisitorSeenSchema
  );

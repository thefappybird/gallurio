import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const PROMO_CODE_TYPES = ["lifetime", "yearly", "monthly", "beta", "beta2mo"] as const;
export type PromoCodeType = (typeof PROMO_CODE_TYPES)[number];

const promoCodeSchema = new Schema(
  {
    title: { type: String, required: true },
    // Lowercased + trimmed at write time — case-insensitive matching via a
    // plain unique index, matching this repo's convention on Workspace.slug/
    // Client.email/Invitation.email (no Mongo collation anywhere here).
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    expiresAt: { type: Date, default: null },
    // Emergency revocation for abuse/compromise — see lib/billing/promoRevocation.ts.
    revokedAt: { type: Date, default: null },
    type: { type: String, enum: PROMO_CODE_TYPES, required: true },
  },
  { timestamps: true },
);

export type PromoCodeDoc = InferSchemaType<typeof promoCodeSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PromoCode: Model<PromoCodeDoc> =
  (mongoose.models.PromoCode as Model<PromoCodeDoc>) ??
  mongoose.model<PromoCodeDoc>("PromoCode", promoCodeSchema);

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const INQUIRY_STATUSES = ["new", "contacted", "converted", "archived"] as const;

const inquirySchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: null, trim: true },
    message: { type: String, default: "" },
    eventDate: { type: Date, default: null },
    eventType: { type: String, default: "other" },
    budgetRange: { type: String, default: null },
    source: {
      utm_source: { type: String, default: null },
      utm_medium: { type: String, default: null },
      utm_campaign: { type: String, default: null },
      referrer: { type: String, default: null },
    },
    status: { type: String, enum: INQUIRY_STATUSES, default: "new", required: true },
    convertedClientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    convertedBookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
  },
  { timestamps: true }
);

inquirySchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
inquirySchema.index({ workspaceId: 1, createdAt: -1 });

export type InquiryDoc = InferSchemaType<typeof inquirySchema> & { _id: mongoose.Types.ObjectId };

export const Inquiry: Model<InquiryDoc> =
  (mongoose.models.Inquiry as Model<InquiryDoc>) ??
  mongoose.model<InquiryDoc>("Inquiry", inquirySchema);

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const bookingImportJobItemSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "BookingImportJob", required: true },
    groupIndex: { type: Number, required: true },
    status: { type: String, enum: ["pending", "done"], default: "pending" },
    leaseToken: { type: String, default: null },
    outcome: { type: Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

bookingImportJobItemSchema.index({ workspaceId: 1, jobId: 1, groupIndex: 1 }, { unique: true });
bookingImportJobItemSchema.index({ workspaceId: 1, jobId: 1, status: 1 });
bookingImportJobItemSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type BookingImportJobItemDoc = InferSchemaType<typeof bookingImportJobItemSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BookingImportJobItem: Model<BookingImportJobItemDoc> =
  (mongoose.models.BookingImportJobItem as Model<BookingImportJobItemDoc>) ??
  mongoose.model<BookingImportJobItemDoc>("BookingImportJobItem", bookingImportJobItemSchema);

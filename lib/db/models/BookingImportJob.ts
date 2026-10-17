import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const bookingImportJobSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    requestId: { type: String, required: true },
    actorUserId: { type: String, required: true },
    rows: { type: [Schema.Types.Mixed], required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    currency: { type: String, required: true },
    timezone: { type: String, required: true },
    totalGroups: { type: Number, required: true },
    status: { type: String, enum: ["queued", "running", "completed", "failed"], default: "queued" },
    active: { type: Boolean, default: true },
    leaseToken: { type: String, default: null },
    leaseUntil: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    result: { type: Schema.Types.Mixed, default: null },
    lastError: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    notificationPending: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

bookingImportJobSchema.index({ workspaceId: 1, requestId: 1 }, { unique: true });
bookingImportJobSchema.index(
  { workspaceId: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);
bookingImportJobSchema.index({ workspaceId: 1, createdAt: -1 });
// The custom server's recovery sweep spans tenants and only reads active jobs.
bookingImportJobSchema.index({ active: 1 });
bookingImportJobSchema.index({ notificationPending: 1 });
bookingImportJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type BookingImportJobDoc = InferSchemaType<typeof bookingImportJobSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BookingImportJob: Model<BookingImportJobDoc> =
  (mongoose.models.BookingImportJob as Model<BookingImportJobDoc>) ??
  mongoose.model<BookingImportJobDoc>("BookingImportJob", bookingImportJobSchema);

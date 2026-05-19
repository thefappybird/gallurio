import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const clientSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    phone: { type: String, default: null, trim: true },
    tags: { type: [String], default: [] },
    source: {
      type: String,
      enum: ["form", "manual", "referral", "import"],
      default: "manual",
    },
    totalSpent: { type: Number, default: 0 },
    lastBookingAt: { type: Date, default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

clientSchema.index({ workspaceId: 1, name: 1 });
clientSchema.index({ workspaceId: 1, email: 1 });
clientSchema.index({ workspaceId: 1, createdAt: -1 });

export type ClientDoc = InferSchemaType<typeof clientSchema> & { _id: mongoose.Types.ObjectId };

export const Client: Model<ClientDoc> =
  (mongoose.models.Client as Model<ClientDoc>) ??
  mongoose.model<ClientDoc>("Client", clientSchema);

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const clientTransactionEntrySchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    // transactionId is null for zero-deposit bookings — no Transaction doc is created in that case
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction", default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: "PHP" },
    type: {
      type: String,
      enum: ["deposit", "balance", "refund", "subscription", "other", "import"],
      required: true,
    },
    occurredAt: { type: Date, required: true },
    source: {
      type: String,
      enum: ["manual", "import", "webhook", "seed"],
      required: true,
    },
  },
  { _id: false }
);

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
    bookingsCount: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    transactions: { type: [clientTransactionEntrySchema], default: [] },
    lastPaymentAmount: { type: Number, default: 0 },
    lastPaymentDate: { type: Date, default: null },
    bookingsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

clientSchema.index({ workspaceId: 1, name: 1 });
clientSchema.index({ workspaceId: 1, email: 1 });
clientSchema.index({ workspaceId: 1, createdAt: -1 });
clientSchema.index({ workspaceId: 1, isActive: 1, name: 1 });

export type ClientDoc = InferSchemaType<typeof clientSchema> & { _id: mongoose.Types.ObjectId };

export const Client: Model<ClientDoc> =
  (mongoose.models.Client as Model<ClientDoc>) ??
  mongoose.model<ClientDoc>("Client", clientSchema);
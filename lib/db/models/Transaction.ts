import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const transactionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: "PHP" },
    type: {
      type: String,
      enum: ["deposit", "balance", "refund", "subscription", "other"],
      required: true,
    },
    method: {
      type: String,
      enum: ["hitpay", "cash", "transfer", "other"],
      default: "hitpay",
    },
    // HitPay identifiers. paymentId covers one-off charges; recurringBillingId
    // covers subscription cycles.
    hitpayPaymentId: { type: String, default: null, index: true, sparse: true },
    hitpayRecurringBillingId: { type: String, default: null },
    notes: { type: String, default: "" },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

transactionSchema.index({ workspaceId: 1, bookingId: 1 });
transactionSchema.index({ workspaceId: 1, paidAt: -1 });

export type TransactionDoc = InferSchemaType<typeof transactionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Transaction: Model<TransactionDoc> =
  (mongoose.models.Transaction as Model<TransactionDoc>) ??
  mongoose.model<TransactionDoc>("Transaction", transactionSchema);

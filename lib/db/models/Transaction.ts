import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const transactionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    // The team that worked the related booking, denormalized at write time from
    // booking.teamId. Never populated — we store the id and read the live Team's
    // current name/color so a team rename/deactivation is reflected on display.
    // Null for transactions with no booking (e.g. subscription charges).
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: "PHP" },
    type: {
      type: String,
      enum: ["deposit", "balance", "refund", "subscription", "other", "import"],
      required: true,
    },
    method: {
      type: String,
      enum: ["lemonsqueezy", "cash", "card", "remit", "transfer", "other"],
      default: "lemonsqueezy",
    },
    // Lemon Squeezy identifiers. orderId covers one-off charges; subscriptionId
    // covers subscription cycles.
    lsOrderId: { type: String, default: null, index: true, sparse: true },
    lsSubscriptionId: { type: String, default: null },
    notes: { type: String, default: "" },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

transactionSchema.index({ workspaceId: 1, bookingId: 1 });
transactionSchema.index({ workspaceId: 1, paidAt: -1 });
// Team revenue grouping (dashboard) — newest paid first within a team.
transactionSchema.index({ workspaceId: 1, teamId: 1, paidAt: -1 });

export type TransactionDoc = InferSchemaType<typeof transactionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Transaction: Model<TransactionDoc> =
  (mongoose.models.Transaction as Model<TransactionDoc>) ??
  mongoose.model<TransactionDoc>("Transaction", transactionSchema);

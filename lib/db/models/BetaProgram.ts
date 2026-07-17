import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Global closable beta window — at most one document ever exists. No unique
// key enforced; callers always findOne({})/upsert with no filter (or the
// $setOnInsert upsert in lib/billing/betaProgram.ts closeBetaProgram). A
// missing document means the program has never been explicitly closed (see
// isBetaProgramClosed) — treat that as "open".
const betaProgramSchema = new Schema(
  {
    startedAt: { type: Date, default: null },
    // Operator-announced target date. This does not close beta automatically;
    // it only drives the final-week in-app warning until an operator closes it.
    scheduledEndAt: { type: Date, default: null },
    scheduledByUserId: { type: String, default: null },
    closedAt: { type: Date, default: null },
    // workosUserId of the operator who closed the program — same convention
    // as Workspace.ownerUserId (plain string, not an ObjectId ref).
    closedByUserId: { type: String, default: null },
  },
  { timestamps: true }
);

export type BetaProgramDoc = InferSchemaType<typeof betaProgramSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BetaProgram: Model<BetaProgramDoc> =
  (mongoose.models.BetaProgram as Model<BetaProgramDoc>) ??
  mongoose.model<BetaProgramDoc>("BetaProgram", betaProgramSchema);

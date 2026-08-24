import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Daily USD-based FX reference-rate snapshot, one document per UTC day.
// Deliberately NOT workspaceId-scoped, unlike every other collection in this
// repo: this is global market data with no tenant dimension — one table
// serves every workspace and every public page (even ones with no resolved
// workspace at all). `_id` is the UTC day ("YYYY-MM-DD"), which sorts
// lexicographically, so "the latest table" is `sort({ _id: -1 }).limit(1)`
// with no extra index needed.
//
// History is kept (not upserted-over) rather than a single "latest" row —
// each day is ~5KB and this doubles as the audit trail behind any restated
// frozen rate (see docs/pricing/currency-conversion.md, "Changing the
// workspace currency"). lib/pricing/fxRates.ts is the only reader/writer.
const fxRateTableSchema = new Schema(
  {
    _id: { type: String, required: true },
    base: { type: String, required: true, default: "USD" },
    rates: { type: Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, required: true },
  },
  { _id: false, versionKey: false }
);

export type FxRateTableDoc = InferSchemaType<typeof fxRateTableSchema> & {
  _id: string;
  rates: Record<string, number>;
};

export const FxRateTable: Model<FxRateTableDoc> =
  (mongoose.models.FxRateTable as Model<FxRateTableDoc>) ??
  mongoose.model<FxRateTableDoc>("FxRateTable", fxRateTableSchema);

// Claim-lease gate so N containers racing a missing today's table produce
// one Open Exchange Rates call, not N. A fixed single row (`_id:
// "fx-fetch-lock"`) rather than a collection per day — there is only ever
// one fetch in flight at a time regardless of which day it is for.
const fxFetchLockSchema = new Schema(
  {
    _id: { type: String, required: true },
    lockedUntil: { type: Date, required: true },
  },
  { _id: false, versionKey: false }
);

export type FxFetchLockDoc = InferSchemaType<typeof fxFetchLockSchema> & { _id: string };

export const FxFetchLock: Model<FxFetchLockDoc> =
  (mongoose.models.FxFetchLock as Model<FxFetchLockDoc>) ??
  mongoose.model<FxFetchLockDoc>("FxFetchLock", fxFetchLockSchema);

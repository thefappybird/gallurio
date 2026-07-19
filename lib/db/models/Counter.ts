import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const counterSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    key: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);
counterSchema.index({ workspaceId: 1, key: 1 }, { unique: true });

export type CounterDoc = InferSchemaType<typeof counterSchema> & { _id: mongoose.Types.ObjectId };
export const Counter: Model<CounterDoc> =
  (mongoose.models.Counter as Model<CounterDoc>) ?? mongoose.model<CounterDoc>("Counter", counterSchema);

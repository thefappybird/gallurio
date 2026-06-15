import { Schema, model, models } from "mongoose";

const previewSnapshotSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
  token: { type: String, required: true, unique: true },
  data: { type: Schema.Types.Mixed },
  brandKit: { type: Schema.Types.Mixed },
  contact: { type: Schema.Types.Mixed },
  header: { type: Schema.Types.Mixed },
  collectionsPopup: { type: Schema.Types.Mixed },
  formLocale: { type: String, default: "" },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export const PreviewSnapshot =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (models.PreviewSnapshot as ReturnType<typeof model<any>>) ??
  model("PreviewSnapshot", previewSnapshotSchema);

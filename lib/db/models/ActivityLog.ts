import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const activityLogSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    actorUserId: { type: String, required: true },
    entity: {
      type: String,
      enum: ["booking", "client", "inquiry", "gallery", "transaction", "workspace"],
      required: true,
    },
    entityId: { type: Schema.Types.ObjectId, default: null },
    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "deleted",
        "status_changed",
        "client_changed",
        "payment_added",
        "payment_updated",
      ],
      required: true,
    },
    diff: { type: Schema.Types.Mixed, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ workspaceId: 1, entity: 1, entityId: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

export type ActivityLogDoc = InferSchemaType<typeof activityLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ActivityLog: Model<ActivityLogDoc> =
  (mongoose.models.ActivityLog as Model<ActivityLogDoc>) ??
  mongoose.model<ActivityLogDoc>("ActivityLog", activityLogSchema);

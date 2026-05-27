import mongoose, { Schema, type InferSchemaType } from "mongoose";

const INVITE_TTL_SECONDS = 30 * 24 * 60 * 60;

const pendingTeamAssignmentSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    teamIds: { type: [Schema.Types.ObjectId], default: [], ref: "Team" },
    leadOnTeamIds: { type: [Schema.Types.ObjectId], default: [], ref: "Team" },
    clerkInvitationId: { type: String, default: null },
    invitedByClerkUserId: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date(), expires: INVITE_TTL_SECONDS },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

pendingTeamAssignmentSchema.index(
  { workspaceId: 1, email: 1 },
  { unique: true },
);

export type PendingTeamAssignmentDoc = InferSchemaType<
  typeof pendingTeamAssignmentSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const PendingTeamAssignment =
  (mongoose.models.PendingTeamAssignment as mongoose.Model<PendingTeamAssignmentDoc>) ??
  mongoose.model<PendingTeamAssignmentDoc>(
    "PendingTeamAssignment",
    pendingTeamAssignmentSchema,
  );

export const PENDING_INVITE_TTL_SECONDS = INVITE_TTL_SECONDS;

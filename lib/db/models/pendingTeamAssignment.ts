import mongoose, { Schema, type InferSchemaType } from "mongoose";

// Mirrors Clerk's organization-invitation expiry. We use this as the cutoff
// the cleanup job applies — NOT as a Mongo TTL. A Mongo TTL would delete the
// document without releasing the reserved Team.memberCount seats, leaving the
// per-team cap permanently over-counted. The cleanup job claims the row,
// decrements seats, then deletes — see releaseExpiredInviteSeats.
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
    // Set to a Date the moment a release path (revoke or cleanup) atomically
    // claims this row. The atomic claim
    // (findOneAndUpdate({_id, releasedAt: null}, {$set: {releasedAt: now}}))
    // guarantees the seat-decrement runs exactly once per invite, even if the
    // cron and the owner-revoke path fire concurrently. The row is then
    // deleted; releasedAt only ever transitions null -> Date -> deleted.
    releasedAt: { type: Date, default: null, index: true },
    createdAt: { type: Date, default: () => new Date() },
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

import mongoose, { Schema, type InferSchemaType } from "mongoose";

// Mirrors Clerk's organization-invitation expiry. We use this as the cutoff
// the cleanup job applies — NOT as a Mongo TTL. A Mongo TTL would delete the
// document without releasing the reserved Team.memberCount seats, leaving the
// per-team cap permanently over-counted.
const INVITE_TTL_SECONDS = 30 * 24 * 60 * 60;

// How long a `claimedFor` lease is honored before another caller can re-claim
// the row. Tuned to be much longer than a normal accept/release path but short
// enough that a crashed worker doesn't pin the row for hours.
export const PENDING_INVITE_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

export const PENDING_INVITE_CLAIM_KINDS = ["release", "accept"] as const;
export type PendingInviteClaimKind = (typeof PENDING_INVITE_CLAIM_KINDS)[number];

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
    // Lease-style claim. The release path and the webhook accept path both
    // race for ownership; only one can transition `claimedFor: null` to one of
    // ("release"|"accept") atomically. If a worker crashes after claiming, the
    // lease expires after PENDING_INVITE_CLAIM_TIMEOUT_MS and another worker
    // can re-claim. The Team-side `pendingReleaseAcks` journal keeps the
    // actual seat refund exactly-once even when multiple workers each claim.
    claimedFor: {
      type: String,
      enum: [...PENDING_INVITE_CLAIM_KINDS, null],
      default: null,
    },
    claimedAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

pendingTeamAssignmentSchema.index(
  { workspaceId: 1, email: 1 },
  { unique: true },
);
// Cron-friendly scan: find rows past their TTL whose lease is either unset or
// stale enough to re-claim.
pendingTeamAssignmentSchema.index({ createdAt: 1, claimedAt: 1 });

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

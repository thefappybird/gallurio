import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const INVITATION_STATUSES = ["pending", "accepted", "revoked", "expired"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

const invitationSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    // Lowercased at write time and on query — stored lowercase for consistent
    // lookups and to satisfy the email-bound security requirement on accept.
    email: { type: String, required: true, lowercase: true, trim: true },
    // Workspace-level role granted to the invitee on accept.
    role: { type: String, enum: ["owner", "staff"], required: true },
    // Teams to enrol the invitee in on accept.
    teamIds: { type: [Schema.Types.ObjectId], ref: "Team", default: [] },
    // Subset of teamIds where the invitee is granted "lead" role.
    leadOnTeamIds: { type: [Schema.Types.ObjectId], ref: "Team", default: [] },
    // SHA-256 hex digest of the high-entropy raw token. The raw token is ONLY
    // placed in the emailed invite link — it never touches the DB or logs.
    tokenHash: { type: String, required: true },
    invitedByWorkosUserId: { type: String, required: true },
    status: {
      type: String,
      enum: INVITATION_STATUSES,
      default: "pending",
      required: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One pending invite per (workspace, email) — re-invite revokes the old one first.
// Partial filter so accepted/revoked/expired rows do not block future invites.
invitationSchema.index(
  { workspaceId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "unique_pending_per_workspace_email",
  },
);

// Single-use token lookup — must be globally unique.
invitationSchema.index({ tokenHash: 1 }, { unique: true });

// Sweep job: find pending invites past their TTL.
invitationSchema.index({ workspaceId: 1, expiresAt: 1 });

// Hourly global sweep (release-expired-invite-seats) queries across all
// workspaces by { status, expiresAt } — not workspace-scoped by design (it is
// a cron job, not a tenant request path). Accepted added-index cost per the
// release checklist.
invitationSchema.index({ status: 1, expiresAt: 1 });

export type InvitationDoc = InferSchemaType<typeof invitationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Invitation: Model<InvitationDoc> =
  (mongoose.models.Invitation as Model<InvitationDoc>) ??
  mongoose.model<InvitationDoc>("Invitation", invitationSchema);

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { TEAM_COLOR_PALETTE } from "@/lib/teams/team-colors";

// Re-exported so existing server/test imports of `TEAM_COLOR_PALETTE` from the
// model keep working. Client components must import from "@/lib/teams/team-colors"
// directly to avoid bundling Mongoose into the browser.
export { TEAM_COLOR_PALETTE };

const teamSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, minlength: 1, maxlength: 40, trim: true },
    color: {
      type: String,
      required: true,
      match: /^#[0-9a-f]{6}$/i,
    },
    isDefault: { type: Boolean, default: false },
    memberCount: { type: Number, default: 0, min: 0 },
    createdByClerkUserId: { type: String, required: true },
    // Journal of PendingTeamAssignment._ids whose seat reservation has been
    // refunded back to this team. The seat-refund operation atomically
    // decrements memberCount AND $addToSets the pendingId here, so any retry
    // (cron, owner-revoke, invite-rollback) sees the ack and no-ops — making
    // the refund exactly-once per (teamId, pendingId) without transactions.
    pendingReleaseAcks: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
  },
  { timestamps: true }
);

teamSchema.index({ workspaceId: 1, name: 1 }, { unique: true });
// Enforce exactly one default ("Main") team per workspace at the index layer
// so concurrent onboarding retries or migration runs can't create duplicates.
teamSchema.index(
  { workspaceId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true },
    name: "one_default_team_per_workspace",
  },
);

export type TeamDoc = InferSchemaType<typeof teamSchema> & { _id: mongoose.Types.ObjectId };

export const Team: Model<TeamDoc> =
  (mongoose.models.Team as Model<TeamDoc>) ??
  mongoose.model<TeamDoc>("Team", teamSchema);

export async function ensureDefaultTeam(
  workspaceId: mongoose.Types.ObjectId,
  createdByClerkUserId: string,
): Promise<TeamDoc> {
  const team = await Team.findOneAndUpdate(
    { workspaceId, isDefault: true },
    {
      $setOnInsert: {
        workspaceId,
        isDefault: true,
        name: "Main",
        color: TEAM_COLOR_PALETTE[0],
        createdByClerkUserId,
        memberCount: 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return team!;
}

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const TEAM_MEMBERSHIP_ROLES = ["member", "lead"] as const;

const teamMembershipSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    clerkUserId: { type: String, required: true, index: true },
    role: { type: String, enum: TEAM_MEMBERSHIP_ROLES, default: "member" },
  },
  { timestamps: true }
);

teamMembershipSchema.index({ workspaceId: 1, clerkUserId: 1 });
teamMembershipSchema.index({ teamId: 1, clerkUserId: 1 }, { unique: true });

export type TeamMembershipDoc = InferSchemaType<typeof teamMembershipSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const TeamMembership: Model<TeamMembershipDoc> =
  (mongoose.models.TeamMembership as Model<TeamMembershipDoc>) ??
  mongoose.model<TeamMembershipDoc>("TeamMembership", teamMembershipSchema);

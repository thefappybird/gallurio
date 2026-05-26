import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const TEAM_COLOR_PALETTE = [
  "#0d7377", // brand teal
  "#7c5cff", // violet
  "#e87a4f", // terracotta
  "#c9aa55", // gold
  "#5fb3a8", // mint
  "#8a8b94", // slate
] as const;

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
  },
  { timestamps: true }
);

teamSchema.index({ workspaceId: 1, name: 1 }, { unique: true });
teamSchema.index({ workspaceId: 1, isDefault: 1 });

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

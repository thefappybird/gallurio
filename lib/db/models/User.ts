import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const membershipSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    role: { type: String, enum: ["owner", "staff"], required: true },
    lastAccessedAt: { type: Date, default: null },
  },
  { _id: false }
);

// "payments" step removed when marketplace was dropped from MVP — tenants no
// longer onboard a payment sub-account during signup. "template" step removed
// and moved to Page Builder / workspace settings.
export const ONBOARDING_STEPS = [
  "business",
  "branding",
  "plan",
  "done",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const userSchema = new Schema(
  {
    workosUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: "" },
    avatarUrl: { type: String, default: null },
    avatarCloudinaryPublicId: { type: String, default: null },
    mfaEnabled: { type: Boolean, default: false },
    memberships: { type: [membershipSchema], default: [] },
    onboardingStep: { type: String, enum: ONBOARDING_STEPS, default: "business" },
    onboardingCompletedAt: { type: Date, default: null },
    timeFormat: { type: String, enum: ["24h", "12h"], default: "24h" },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ?? mongoose.model<UserDoc>("User", userSchema);

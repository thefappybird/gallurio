import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const membershipSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    role: { type: String, enum: ["owner", "staff"], required: true },
  },
  { _id: false }
);

// "payments" step removed when marketplace was dropped from MVP — tenants no
// longer onboard a payment sub-account during signup.
export const ONBOARDING_STEPS = [
  "business",
  "branding",
  "template",
  "plan",
  "done",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const userSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: "" },
    avatarUrl: { type: String, default: null },
    avatarCloudinaryPublicId: { type: String, default: null },
    memberships: { type: [membershipSchema], default: [] },
    onboardingStep: { type: String, enum: ONBOARDING_STEPS, default: "business" },
    onboardingCompletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ?? mongoose.model<UserDoc>("User", userSchema);

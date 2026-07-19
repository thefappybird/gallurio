import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const membershipSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    role: { type: String, enum: ["owner", "staff"], required: true },
    lastAccessedAt: { type: Date, default: null },
  },
  { _id: false }
);

// "template" step was moved to Page Builder / workspace settings. Keep in sync with
// STEP_META in app/[locale]/(onboarding)/onboarding/_components/step-shell.tsx.
export const ONBOARDING_STEPS = [
  "business",
  "workspace",
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
    avatarAssetId: { type: String, default: null },
    mfaEnabled: { type: Boolean, default: false },
    memberships: { type: [membershipSchema], default: [] },
    onboardingStep: { type: String, enum: ONBOARDING_STEPS, default: "business" },
    onboardingCompletedAt: { type: Date, default: null },
    timeFormat: { type: String, enum: ["24h", "12h"], default: "24h" },
    // Set once, permanently, the first time this user's account consumes the
    // one-month free-Pro grant on workspace creation. Guards "one free month
    // per user (email)" — see lib/actions/onboarding.ts.
    freeTrialConsumedAt: { type: Date, default: null },
    // Set once, permanently, the first time this user's account gets a
    // plan:"beta" grant. Durable identity-level evidence of beta
    // participation, independent of the workspace's current plan (which
    // reverts to "free" when the global beta program closes) — see
    // lib/actions/onboarding.ts activateBetaTesterAction and the backfill
    // migration for workspaces that were already on plan:"beta" before this
    // field existed.
    betaParticipation: {
      recordedAt: { type: Date, default: null },
      source: { type: String, enum: ["onboarding", "backfill", null], default: null },
    },
    // Set once, permanently, when this identity redeems the two-month
    // post-beta Pro promo. Identity-scoped (not workspace-scoped) — guards
    // "one redemption per eligible user identity" even if they own multiple
    // workspaces. See lib/actions/promoCode.ts (later wave).
    betaPromoRedeemedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ?? mongoose.model<UserDoc>("User", userSchema);

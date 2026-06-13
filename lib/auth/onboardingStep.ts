import "server-only";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/mongoose";
import {
  User,
  Workspace,
  ONBOARDING_STEPS,
  type OnboardingStep,
  type WorkspaceDoc,
  type UserDoc,
} from "@/lib/db/models";
import { getAuthUser } from "./session";
import { getActiveWorkspaceId } from "./activeWorkspace";

export type OnboardingContext = {
  userId: string;
  user: UserDoc | null;
  workspace: WorkspaceDoc | null;
  /** The furthest step the user has reached. Earlier steps are also reachable. */
  currentStep: OnboardingStep;
};

export const STEP_ORDER: ReadonlyArray<OnboardingStep> = ONBOARDING_STEPS;

export function stepIndex(step: OnboardingStep): number {
  return STEP_ORDER.indexOf(step);
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const idx = stepIndex(step);
  if (idx <= 0) return null;
  return STEP_ORDER[idx - 1];
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const idx = stepIndex(step);
  if (idx < 0 || idx >= STEP_ORDER.length - 1) return null;
  return STEP_ORDER[idx + 1];
}

/**
 * Loads the current onboarding context for the authenticated user.
 *
 * The workspace is resolved leniently: the user may have no workspace yet
 * (e.g. mid-onboarding), so workspace is null when none can be resolved.
 * Redirects unauthenticated users to /sign-in.
 */
export async function loadOnboardingContext(): Promise<OnboardingContext> {
  const authUser = await getAuthUser();
  if (!authUser) redirect("/sign-in");

  await connectDB();

  const user = await User.findOne({ workosUserId: authUser.workosUserId }).lean<UserDoc>();

  // Resolve workspace leniently — may be null during early onboarding steps.
  let workspace: WorkspaceDoc | null = null;
  if (user && user.memberships.length > 0) {
    const workspaceId = await getActiveWorkspaceId(user.memberships);
    if (workspaceId) {
      workspace = await Workspace.findById(workspaceId).lean<WorkspaceDoc>();
    }
  }

  let currentStep: OnboardingStep = user?.onboardingStep ?? "business";

  // Users who were mid-flight at the now-removed "template" step get bumped to
  // "plan" so they are not stranded at a deleted route.
  if ((currentStep as string) === "template") {
    currentStep = "plan";
    if (user) {
      await User.updateOne(
        { workosUserId: authUser.workosUserId },
        { $set: { onboardingStep: "plan" } },
      );
    }
  }

  return {
    userId: authUser.workosUserId,
    user: user ?? null,
    workspace: workspace ?? null,
    currentStep,
  };
}

export function requireStep(ctx: OnboardingContext, step: OnboardingStep) {
  // onboardingCompletedAt — not the step value — is the source of truth for
  // "fully finished onboarding." This lets the done page exist as a real step.
  if (ctx.user?.onboardingCompletedAt) redirect("/dashboard");
  // Allow visiting any step at or before the user's furthest step.
  // Block only forward jumps past where the user has actually progressed.
  if (stepIndex(step) > stepIndex(ctx.currentStep)) {
    redirect(`/onboarding/${ctx.currentStep}`);
  }
}

import { auth } from "@clerk/nextjs/server";
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

export async function loadOnboardingContext(): Promise<OnboardingContext> {
  const session = await auth();
  if (!session.userId) redirect("/sign-in");

  await connectDB();

  const [user, workspace] = await Promise.all([
    User.findOne({ clerkUserId: session.userId }).lean<UserDoc>(),
    session.orgId
      ? Workspace.findOne({ clerkOrgId: session.orgId }).lean<WorkspaceDoc>()
      : Promise.resolve(null),
  ]);

  const currentStep: OnboardingStep = user?.onboardingStep ?? "business";

  return {
    userId: session.userId,
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

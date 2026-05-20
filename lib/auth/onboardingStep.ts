import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/mongoose";
import { User, Workspace, type OnboardingStep, type WorkspaceDoc, type UserDoc } from "@/lib/db/models";

export type OnboardingContext = {
  userId: string;
  user: UserDoc | null;
  workspace: WorkspaceDoc | null;
  currentStep: OnboardingStep;
};

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
  if (ctx.currentStep === "done") redirect("/dashboard");
  if (ctx.currentStep !== step) {
    redirect(`/onboarding/${ctx.currentStep}`);
  }
}

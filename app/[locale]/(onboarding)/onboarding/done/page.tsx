import { redirect } from "next/navigation";
import {
  loadOnboardingContext,
  stepIndex,
} from "@/lib/auth/onboardingStep";
import { hasDemoImportMarker } from "@/lib/auth/demoImportMarker";
import { connectDB } from "@/lib/db/mongoose";
import { ONBOARDING_STEPS, User, Workspace, type PlanTier } from "@/lib/db/models";
import { reconcileLemonSqueezySubscription } from "@/lib/actions/onboarding";
import { DoneStepForm } from "./done-form";

// When the user lands on the done page we eagerly reconcile the Lemon Squeezy
// subscription onto the workspace. The webhook + workflow are the primary path;
// this is the safety net for the race between the user completing checkout and
// the webhook firing. Lemon Squeezy checkout completes via an overlay event
// rather than a redirect, so we reconcile unconditionally on load rather than
// gating on a query param.
export default async function DoneStepPage() {
  const ctx = await loadOnboardingContext();
  const hasDemoImport = await hasDemoImportMarker();

  if (ctx.user?.onboardingCompletedAt) {
    redirect(hasDemoImport ? "/portfolio" : "/dashboard");
  }

  if (stepIndex(ctx.currentStep) < stepIndex("plan")) {
    redirect(`/onboarding/${ctx.currentStep}`);
  }

  if (ctx.workspace) {
    await reconcileLemonSqueezySubscription(ctx.workspace._id.toString());
  }

  let workspaceName = ctx.workspace?.name ?? "your workspace";
  let plan: PlanTier = ctx.workspace?.plan ?? "free";

  if (ctx.workspace) {
    await connectDB();
    const refreshed = await Workspace.findOne({ _id: ctx.workspace._id })
      .select({ name: 1, plan: 1 })
      .lean<{ name: string; plan: PlanTier }>();
    if (refreshed) {
      workspaceName = refreshed.name;
      plan = refreshed.plan;
    }
  }

  const earlierThanDone = ONBOARDING_STEPS.slice(0, ONBOARDING_STEPS.indexOf("done"));
  await User.updateOne(
    { workosUserId: ctx.userId, onboardingStep: { $in: earlierThanDone } },
    { $set: { onboardingStep: "done" } }
  );

  return (
    <DoneStepForm
      furthestStep="done"
      workspaceName={workspaceName}
      plan={plan}
      finishDestination={hasDemoImport ? "portfolio" : "dashboard"}
    />
  );
}

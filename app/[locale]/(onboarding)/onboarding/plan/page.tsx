import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import { PlanStepForm } from "./plan-form";

export default async function PlanStepPage() {
  const ctx = await loadOnboardingContext();
  requireStep(ctx, "plan");

  return (
    <PlanStepForm
      furthestStep={ctx.currentStep}
      currentPlan={ctx.workspace?.plan ?? "free"}
    />
  );
}

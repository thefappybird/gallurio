import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import { getProPricing } from "@/lib/lemonsqueezy/pricing";
import { PlanStepForm } from "./plan-form";

export default async function PlanStepPage() {
  const ctx = await loadOnboardingContext();
  requireStep(ctx, "plan");
  const proPricing = await getProPricing();

  return (
    <PlanStepForm
      furthestStep={ctx.currentStep}
      currentPlan={ctx.workspace?.plan ?? "free"}
      proPricing={proPricing}
    />
  );
}

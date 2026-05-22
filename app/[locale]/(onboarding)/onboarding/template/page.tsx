import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import { TemplateStepForm } from "./template-form";

export default async function TemplateStepPage() {
  const ctx = await loadOnboardingContext();
  requireStep(ctx, "template");

  const current = (ctx.workspace?.publicPage?.templateId ?? "default") as
    | "default"
    | "editorial"
    | "studio";

  return <TemplateStepForm furthestStep={ctx.currentStep} initial={current} />;
}

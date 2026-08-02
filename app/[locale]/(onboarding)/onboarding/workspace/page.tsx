import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import { coerceBillingCountry } from "@/lib/validators/workspace";
import { portfolioBaseDomain } from "@/lib/portfolio/publicUrl";
import { WorkspaceStepForm } from "./workspace-form";

export default async function WorkspaceStepPage() {
  const ctx = await loadOnboardingContext();
  requireStep(ctx, "workspace");

  return (
    <WorkspaceStepForm
      furthestStep={ctx.currentStep}
      portfolioDomain={portfolioBaseDomain()}
      defaults={{
        slug: ctx.workspace?.slug ?? "",
        country: coerceBillingCountry(ctx.workspace?.country),
        timezone:
          ctx.workspace?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        timeFormat: ctx.user?.timeFormat ?? "24h",
      }}
    />
  );
}

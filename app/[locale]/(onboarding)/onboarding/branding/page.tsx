import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import { BrandingStepForm } from "./branding-form";

export default async function BrandingStepPage() {
  const ctx = await loadOnboardingContext();
  requireStep(ctx, "branding");

  return (
    <BrandingStepForm
      furthestStep={ctx.currentStep}
      defaults={{
        logoUrl: ctx.workspace?.branding?.logoUrl ?? null,
        logoCloudinaryPublicId: ctx.workspace?.branding?.logoCloudinaryPublicId ?? null,
        primaryColor: ctx.workspace?.branding?.primaryColor ?? "#111111",
        secondaryColor: ctx.workspace?.branding?.secondaryColor ?? "#f5f5f5",
        tagline: ctx.workspace?.branding?.tagline ?? "",
        description: ctx.workspace?.branding?.description ?? "",
      }}
    />
  );
}

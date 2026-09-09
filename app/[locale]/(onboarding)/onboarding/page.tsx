import { redirect } from "next/navigation";
import { loadOnboardingContext } from "@/lib/auth/onboardingStep";
import { hasDemoImportMarker } from "@/lib/auth/demoImportMarker";

export default async function OnboardingIndexPage() {
  const ctx = await loadOnboardingContext();
  if (ctx.user?.onboardingCompletedAt) {
    redirect((await hasDemoImportMarker()) ? "/portfolio" : "/dashboard");
  }
  redirect(`/onboarding/${ctx.currentStep}`);
}

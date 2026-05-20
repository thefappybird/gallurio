import { redirect } from "next/navigation";
import { loadOnboardingContext } from "@/lib/auth/onboardingStep";

export default async function OnboardingIndexPage() {
  const ctx = await loadOnboardingContext();
  if (ctx.currentStep === "done") redirect("/dashboard");
  redirect(`/onboarding/${ctx.currentStep}`);
}

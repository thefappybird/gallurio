import { currentUser } from "@clerk/nextjs/server";
import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import { BusinessStepForm } from "./business-form";

export default async function BusinessStepPage() {
  const ctx = await loadOnboardingContext();
  requireStep(ctx, "business");

  const user = await currentUser();

  return (
    <BusinessStepForm
      defaults={{
        firstName: user?.firstName ?? "",
        lastName: user?.lastName ?? "",
        name: ctx.workspace?.name ?? "",
        slug: ctx.workspace?.slug ?? "",
        businessType: (ctx.workspace?.businessType as
          | "photographer"
          | "venue"
          | "planner"
          | "stylist"
          | "catering"
          | "entertainer"
          | "other") ?? "photographer",
        country: ctx.workspace?.country ?? "US",
        timezone:
          ctx.workspace?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      }}
    />
  );
}

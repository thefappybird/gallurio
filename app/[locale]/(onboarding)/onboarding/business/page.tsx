import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import { getAuthUser } from "@/lib/auth/session";
import type { BusinessStepInput } from "@/lib/validators/workspace";
import { BusinessStepForm } from "./business-form";

export default async function BusinessStepPage() {
  const ctx = await loadOnboardingContext();
  requireStep(ctx, "business");

  // Split the WorkOS display name into first/last for form pre-fill.
  // WorkOS stores a single `name` string; best-effort split on first space.
  const authUser = await getAuthUser();
  const [firstName = "", ...rest] = (authUser?.name ?? "").split(" ");
  const lastName = rest.join(" ");

  return (
    <BusinessStepForm
      furthestStep={ctx.currentStep}
      defaults={{
        firstName,
        lastName,
        name: ctx.workspace?.name ?? "",
        businessType:
          (ctx.workspace?.businessType as BusinessStepInput["businessType"]) ??
          "photographer",
        businessTypeOther: ctx.workspace?.businessTypeOther ?? "",
      }}
    />
  );
}

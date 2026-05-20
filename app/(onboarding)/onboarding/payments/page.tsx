import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import { PaymentsStepForm } from "./payments-form";

export default async function PaymentsStepPage() {
  const ctx = await loadOnboardingContext();
  requireStep(ctx, "payments");

  return (
    <PaymentsStepForm
      hasAccount={Boolean(ctx.workspace?.stripeConnectAccountId)}
      chargesEnabled={Boolean(ctx.workspace?.stripeConnectChargesEnabled)}
      detailsSubmitted={Boolean(ctx.workspace?.stripeConnectDetailsSubmitted)}
    />
  );
}

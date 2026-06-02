import { currentUser } from "@clerk/nextjs/server";
import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import {
  HITPAY_COUNTRY_VALUES,
  SUPPORTED_CURRENCIES,
  COUNTRY_TO_CURRENCY,
  type HitpayCountry,
  type SupportedCurrency,
} from "@/lib/validators/workspace";
import { BusinessStepForm } from "./business-form";

function coerceCountry(value: string | null | undefined): HitpayCountry {
  return (HITPAY_COUNTRY_VALUES as readonly string[]).includes(value ?? "")
    ? (value as HitpayCountry)
    : "PH";
}

function coerceCurrency(
  value: string | null | undefined,
  country: HitpayCountry
): SupportedCurrency {
  if ((SUPPORTED_CURRENCIES as readonly string[]).includes(value ?? "")) {
    return value as SupportedCurrency;
  }
  return COUNTRY_TO_CURRENCY[country];
}

export default async function BusinessStepPage() {
  const ctx = await loadOnboardingContext();
  requireStep(ctx, "business");

  const user = await currentUser();

  return (
    <BusinessStepForm
      furthestStep={ctx.currentStep}
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
        country: coerceCountry(ctx.workspace?.country),
        currency: coerceCurrency(
          ctx.workspace?.currency,
          coerceCountry(ctx.workspace?.country)
        ),
        timezone:
          ctx.workspace?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      }}
    />
  );
}

import { loadOnboardingContext, requireStep } from "@/lib/auth/onboardingStep";
import { getAuthUser } from "@/lib/auth/session";
import {
  BILLING_COUNTRY_VALUES,
  SUPPORTED_CURRENCIES,
  COUNTRY_TO_CURRENCY,
  type SupportedCountry,
  type SupportedCurrency,
} from "@/lib/validators/workspace";
import { BusinessStepForm } from "./business-form";

function coerceCountry(value: string | null | undefined): SupportedCountry {
  return (BILLING_COUNTRY_VALUES as readonly string[]).includes(value ?? "")
    ? (value as SupportedCountry)
    : "PH";
}

function coerceCurrency(
  value: string | null | undefined,
  country: SupportedCountry
): SupportedCurrency {
  if ((SUPPORTED_CURRENCIES as readonly string[]).includes(value ?? "")) {
    return value as SupportedCurrency;
  }
  return COUNTRY_TO_CURRENCY[country];
}

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

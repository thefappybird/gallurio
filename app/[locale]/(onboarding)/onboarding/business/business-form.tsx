"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOrganizationList } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { OnboardingStep } from "@/lib/db/models";
import {
  businessStepSchema,
  BILLING_COUNTRY_VALUES,
  SUPPORTED_CURRENCIES,
  COUNTRY_TO_CURRENCY,
  type BusinessStepInput,
  type SupportedCountry,
  type SupportedCurrency,
} from "@/lib/validators/workspace";
import { businessStepAction } from "@/lib/actions/onboarding";
import { StepShell, StepBackButton } from "../_components/step-shell";
import { BusinessIllustration } from "../_components/illustrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TIMEZONE_GROUPS } from "@/lib/utils/timezones";

const COUNTRY_LABELS: Record<SupportedCountry, string> = {
  PH: "Philippines",
  SG: "Singapore",
  MY: "Malaysia",
  ID: "Indonesia",
  TH: "Thailand",
  AU: "Australia",
  CA: "Canada",
  NZ: "New Zealand",
  GB: "United Kingdom",
  US: "United States",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  OM: "Oman",
  BH: "Bahrain",
};
const COUNTRIES = BILLING_COUNTRY_VALUES.map((value) => ({
  value,
  label: COUNTRY_LABELS[value],
}));

const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  PHP: "Philippine Peso (₱)",
  SGD: "Singapore Dollar (S$)",
  MYR: "Malaysian Ringgit (RM)",
  IDR: "Indonesian Rupiah (Rp)",
  THB: "Thai Baht (฿)",
  AUD: "Australian Dollar (A$)",
  CAD: "Canadian Dollar (C$)",
  NZD: "New Zealand Dollar (NZ$)",
  GBP: "British Pound (£)",
  USD: "US Dollar ($)",
  AED: "UAE Dirham (د.إ)",
  SAR: "Saudi Riyal (﷼)",
  QAR: "Qatari Riyal (﷼)",
  KWD: "Kuwaiti Dinar (د.ك)",
  OMR: "Omani Rial (﷼)",
  BHD: "Bahraini Dinar (.د.ب)",
};
const CURRENCIES = SUPPORTED_CURRENCIES.map((value) => ({
  value,
  label: CURRENCY_LABELS[value],
}));

function toSlug(val: string) {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export function BusinessStepForm({
  defaults,
  furthestStep,
}: {
  defaults: BusinessStepInput;
  furthestStep: OnboardingStep;
}) {
  const t = useTranslations("onboarding.business");
  const tShell = useTranslations("onboarding.shell");
  const router = useRouter();
  const { setActive } = useOrganizationList();
  const [, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BusinessStepInput>({
    resolver: zodResolver(businessStepSchema),
    defaultValues: defaults,
  });

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue("name", e.target.value);
    if (!defaults.slug) {
      setValue("slug", toSlug(e.target.value), { shouldValidate: true });
    }
  }

  async function onSubmit(data: BusinessStepInput) {
    const result = await businessStepAction(data);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    if (result.orgIdToActivate && setActive) {
      await setActive({ organization: result.orgIdToActivate });
    }
    startTransition(() => router.push("/onboarding/branding"));
  }

  const businessTypes = [
    { value: "photographer", label: t("businessTypes.photographer") },
    { value: "venue", label: t("businessTypes.venue") },
    { value: "planner", label: t("businessTypes.planner") },
    { value: "stylist", label: t("businessTypes.stylist") },
    { value: "catering", label: t("businessTypes.catering") },
    { value: "entertainer", label: t("businessTypes.entertainer") },
    { value: "other", label: t("businessTypes.other") },
  ] as const;

  return (
    <StepShell
      step="business"
      furthestStep={furthestStep}
      title={t("title")}
      description={t("description")}
      illustration={<BusinessIllustration />}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">{t("firstName")}</Label>
            <Input id="firstName" placeholder={t("firstNamePlaceholder")} {...register("firstName")} />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lastName">
              {t("lastName")}{" "}
              <span className="font-normal text-muted-foreground">({t("optional")})</span>
            </Label>
            <Input id="lastName" placeholder={t("lastNamePlaceholder")} {...register("lastName")} />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{t("businessName")}</Label>
          <Input
            id="name"
            placeholder={t("businessNamePlaceholder")}
            {...register("name")}
            onChange={handleNameChange}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">
            {t("workspaceUrl")}{" "}
            <span className="font-normal text-muted-foreground">{t("workspaceUrlNote")}</span>
          </Label>
          <div className="flex items-stretch">
            <span className="flex items-center border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
              gallurio.com/w/
            </span>
            <Input id="slug" placeholder={t("slugPlaceholder")} {...register("slug")} />
          </div>
          {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessType">{t("businessType")}</Label>
            <select
              id="businessType"
              className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("businessType")}
            >
              {businessTypes.map((bt) => (
                <option key={bt.value} value={bt.value}>
                  {bt.label}
                </option>
              ))}
            </select>
            {errors.businessType && (
              <p className="text-sm text-destructive">{errors.businessType.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="country">{t("country")}</Label>
            <select
              id="country"
              className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("country", {
                onChange: (e) => {
                  const next = e.target.value as SupportedCountry;
                  setValue("currency", COUNTRY_TO_CURRENCY[next], {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                },
              })}
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.country && (
              <p className="text-sm text-destructive">{errors.country.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currency">{t("currency")}</Label>
            <select
              id="currency"
              className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("currency")}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t("currencyHelp")}</p>
            {errors.currency && (
              <p className="text-sm text-destructive">{errors.currency.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timezone">{t("timezone")}</Label>
            <select
              id="timezone"
              className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("timezone")}
            >
              {Object.entries(TIMEZONE_GROUPS).map(([region, zones]) => (
                <optgroup key={region} label={region}>
                  {zones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {errors.timezone && (
              <p className="text-sm text-destructive">{errors.timezone.message}</p>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div>
            <StepBackButton from="business" />
          </div>
          <Button type="submit" disabled={isSubmitting} className="min-w-40">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tShell("saving")}
              </>
            ) : (
              tShell("continue")
            )}
          </Button>
        </div>
      </form>
    </StepShell>
  );
}

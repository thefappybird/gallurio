"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toastActionResult } from "@/lib/utils/handleActionResult";
import {
  updateWorkspaceBusinessSchema,
  BILLING_COUNTRY_VALUES,
  SUPPORTED_CURRENCIES,
  COUNTRY_TO_CURRENCY,
  type UpdateWorkspaceBusinessInput,
  type SupportedCountry,
  type SupportedCurrency,
} from "@/lib/validators/workspace";
import { updateWorkspaceBusinessAction } from "../_actions";
import { TIMEZONE_GROUPS } from "@/lib/utils/timezones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export function WorkspaceBusinessForm({
  defaults,
}: {
  defaults: UpdateWorkspaceBusinessInput;
}) {
  const t = useTranslations("app.settings.workspace");
  const tOnb = useTranslations("onboarding.business");

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateWorkspaceBusinessInput>({
    resolver: zodResolver(updateWorkspaceBusinessSchema),
    defaultValues: defaults,
  });

  async function onSubmit(data: UpdateWorkspaceBusinessInput) {
    const result = await updateWorkspaceBusinessAction(data);
    if (!toastActionResult(result, t("savedToast"))) return;
    reset(data);
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{t("businessSection")}</h2>
        <p className="text-sm text-muted-foreground">{t("businessSectionHint")}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{tOnb("businessName")}</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">
            {tOnb("workspaceUrl")}{" "}
            <span className="font-normal text-muted-foreground">{tOnb("workspaceUrlNote")}</span>
          </Label>
          <div className="flex items-stretch">
            <span className="flex items-center border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
              gallurio.com/w/
            </span>
            <Input id="slug" {...register("slug")} />
          </div>
          {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessType">{tOnb("businessType")}</Label>
            <select
              id="businessType"
              className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("businessType")}
            >
              <option value="photographer">{tOnb("businessTypes.photographer")}</option>
              <option value="venue">{tOnb("businessTypes.venue")}</option>
              <option value="planner">{tOnb("businessTypes.planner")}</option>
              <option value="stylist">{tOnb("businessTypes.stylist")}</option>
              <option value="catering">{tOnb("businessTypes.catering")}</option>
              <option value="entertainer">{tOnb("businessTypes.entertainer")}</option>
              <option value="other">{tOnb("businessTypes.other")}</option>
            </select>
            {errors.businessType && (
              <p className="text-sm text-destructive">{errors.businessType.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="country">{tOnb("country")}</Label>
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
              {BILLING_COUNTRY_VALUES.map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_LABELS[c]}
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
            <Label htmlFor="currency">{tOnb("currency")}</Label>
            <select
              id="currency"
              className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("currency")}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_LABELS[c]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t("currencyWarning")}</p>
            {errors.currency && (
              <p className="text-sm text-destructive">{errors.currency.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timezone">{tOnb("timezone")}</Label>
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

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}

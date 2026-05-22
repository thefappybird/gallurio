"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOrganizationList } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import type { OnboardingStep } from "@/lib/db/models";
import {
  businessStepSchema,
  HITPAY_COUNTRY_VALUES,
  type BusinessStepInput,
  type HitpayCountry,
} from "@/lib/validators/workspace";
import { businessStepAction } from "@/lib/actions/onboarding";
import { StepShell, StepBackButton } from "../_components/step-shell";
import { BusinessIllustration } from "../_components/illustrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ALL_TIMEZONES: string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["Etc/UTC"];

type TimezoneOption = { value: string; label: string; offsetMinutes: number };

// "longOffset" returns a stable "GMT+08:00" / "GMT-03:30" / "GMT" string on both
// Node and modern browsers, where "shortOffset" disagrees and causes hydration
// mismatches. Parse it once and derive everything else from the numeric value.
function offsetMinutes(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    }).formatToParts(new Date());
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const match = raw.match(/GMT([+-])(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    const sign = match[1] === "-" ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3]));
  } catch {
    return 0;
  }
}

function formatUtcOffset(mins: number): string {
  if (mins === 0) return "UTC";
  const sign = mins < 0 ? "-" : "+";
  const abs = Math.abs(mins);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}

const TIMEZONE_GROUPS = ALL_TIMEZONES.reduce<Record<string, TimezoneOption[]>>((acc, tz) => {
  const region = tz.split("/")[0] || "Other";
  acc[region] = acc[region] ?? [];
  const mins = offsetMinutes(tz);
  acc[region].push({
    value: tz,
    label: `${tz.replace(/_/g, " ")} (${formatUtcOffset(mins)})`,
    offsetMinutes: mins,
  });
  return acc;
}, {});

for (const region of Object.keys(TIMEZONE_GROUPS)) {
  TIMEZONE_GROUPS[region].sort((a, b) =>
    a.offsetMinutes !== b.offsetMinutes
      ? a.offsetMinutes - b.offsetMinutes
      : a.value.localeCompare(b.value)
  );
}

// HitPay's supported merchant markets. Expanding later is just adding entries
// here AND to HITPAY_COUNTRY_VALUES in lib/validators/workspace.ts.
const COUNTRY_LABELS: Record<HitpayCountry, string> = {
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
};
const COUNTRIES = HITPAY_COUNTRY_VALUES.map((value) => ({
  value,
  label: COUNTRY_LABELS[value],
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
  const [serverError, setServerError] = useState<string | null>(null);
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
    setServerError(null);
    try {
      const result = await businessStepAction(data);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      if (result.orgIdToActivate && setActive) {
        await setActive({ organization: result.orgIdToActivate });
      }
      startTransition(() => router.push("/onboarding/branding"));
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    }
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
              {...register("country")}
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

        {serverError && (
          <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

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

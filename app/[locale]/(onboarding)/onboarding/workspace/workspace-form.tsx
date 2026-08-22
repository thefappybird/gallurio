"use client";

import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { OnboardingStep } from "@/lib/db/models";
import {
  workspaceSetupSchema,
  BILLING_COUNTRY_VALUES,
  type WorkspaceSetupInput,
  type SupportedCountry,
} from "@/lib/validators/workspace";
import { workspaceStepAction } from "@/lib/actions/onboarding";
import { StepShell, StepBackButton } from "../_components/step-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { SlugStatusIndicator } from "@/components/app/slug-status-indicator";
import { useSlugAvailability } from "@/hooks/useSlugAvailability";
import { TimezoneCombobox } from "@/components/ui/timezone-combobox";
import { useActionError } from "@/lib/i18n/actionError";
import { FormField, useFieldError } from "@/components/ui/form-field";
import { fieldMessage } from "@/lib/utils/fieldMessage";

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

export function WorkspaceStepForm({
  defaults,
  furthestStep,
  portfolioDomain,
}: {
  defaults: WorkspaceSetupInput;
  furthestStep: OnboardingStep;
  // Resolved by the server page and serialized into the initial RSC payload.
  // Reading NEXT_PUBLIC_* here caused the server and browser bundles to see
  // different values during local env changes, producing a hydration mismatch.
  portfolioDomain: string | null;
}) {
  const t = useTranslations("onboarding.workspace");
  // Slug field copy reuses onboarding.business's existing workspaceUrl/slug*
  // keys — the field only moved a step, the copy didn't change.
  const tSlug = useTranslations("onboarding.business");
  const tShell = useTranslations("onboarding.shell");
  const errMsg = useActionError();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<WorkspaceSetupInput>({
    resolver: zodResolver(workspaceSetupSchema),
    defaultValues: defaults,
  });

  const slugValue = useWatch({ control, name: "slug" });
  // The value starts as an automatically generated slug. It still needs a
  // live check: another workspace may have claimed it since step one, and the
  // submit action performs the authoritative race-safe check before advancing.
  const { status: slugStatus } = useSlugAvailability(slugValue);
  const timeFormatValue = useWatch({ control, name: "timeFormat" });

  const slugError = fieldMessage(errors.slug);
  const slugInvalid = slugStatus === "taken" || slugStatus === "invalid" || !!slugError;
  const slugA11y = useFieldError(slugError, { id: "slug", describedBy: "slug-status" });
  const countryError = fieldMessage(errors.country);
  const timezoneError = fieldMessage(errors.timezone);

  async function onSubmit(data: WorkspaceSetupInput) {
    const result = await workspaceStepAction(data);
    if (result?.error) {
      toast.error(errMsg(result.error));
      return;
    }
    router.refresh();
    startTransition(() => router.push("/onboarding/plan"));
  }

  return (
    <StepShell
      step="workspace"
      furthestStep={furthestStep}
      title={t("title")}
      description={t("description")}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            <StepBackButton from="workspace" />
          </div>
          <Button
            form="workspace-step-form"
            type="submit"
            variant="brand"
            disabled={isSubmitting || slugStatus === "checking" || slugStatus === "taken" || slugStatus === "invalid"}
            className="min-w-40"
          >
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
      }
    >
      <form id="workspace-step-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={slugA11y.id}>
            {tSlug("workspaceUrl")}{" "}
            <span className="font-normal text-muted-foreground">{tSlug("workspaceUrlNote")}</span>
          </Label>
          <div className="flex items-stretch">
            {!portfolioDomain && (
              <span className="flex items-center border border-e-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
                gallurio.com/w/
              </span>
            )}
            <Input
              id={slugA11y.id}
              placeholder={tSlug("slugPlaceholder")}
              className={portfolioDomain ? "flex-1" : undefined}
              aria-invalid={slugInvalid || undefined}
              aria-describedby={slugA11y["aria-describedby"]}
              {...register("slug")}
            />
            {portfolioDomain && (
              <span className="flex shrink-0 items-center border border-s-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
                .{portfolioDomain}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center gap-2">
            <div id="slug-status">
              <SlugStatusIndicator status={slugStatus} t={tSlug} />
            </div>
            {slugValue && (
              <p className="text-xs text-muted-foreground">
                {tSlug("slugPreview")} <span className="font-mono">
                  {portfolioDomain ? `${slugValue}.${portfolioDomain}` : `gallurio.com/w/${slugValue}`}
                </span>
              </p>
            )}
          </div>
          {slugError && (
            <p id={slugA11y.errorId} role="alert" className="text-sm text-destructive">
              {slugError}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField id="country" label={t("country")} error={countryError}>
            {({ id, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedby }) => (
              <select
                id={id}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedby}
                className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("country")}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField id="timezone" label={t("timezone")} error={timezoneError}>
            {({ id, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedby }) => (
              <Controller
                control={control}
                name="timezone"
                render={({ field }) => (
                  <TimezoneCombobox
                    id={id}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={field.disabled}
                    invalid={!!ariaInvalid}
                    ariaDescribedby={ariaDescribedby}
                    searchPlaceholder={tSlug("timezoneSearchPlaceholder")}
                    noMatchesLabel={tSlug("timezoneNoMatches")}
                  />
                )}
              />
            )}
          </FormField>

          <div className="flex flex-col gap-1.5">
            <Label id="time-format-label">{t("timeFormat")}</Label>
            <SegmentedToggle
              ariaLabel={t("timeFormat")}
              value={timeFormatValue}
              onChange={(v) =>
                setValue("timeFormat", v, { shouldValidate: true, shouldDirty: true })
              }
              options={[
                { key: "12h", label: t("time12h") },
                { key: "24h", label: t("time24h") },
              ]}
              className="sm:flex sm:w-full"
            />
          </div>
        </div>

      </form>
    </StepShell>
  );
}

"use client";

import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Camera,
  Building2,
  ClipboardList,
  Scissors,
  UtensilsCrossed,
  Music,
  Palette,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { OnboardingStep } from "@/lib/db/models";
import { businessStepSchema, type BusinessStepInput } from "@/lib/validators/workspace";
import { businessStepAction } from "@/lib/actions/onboarding";
import { StepShell, StepBackButton, isStepCompleted } from "../_components/step-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionError } from "@/lib/i18n/actionError";
import { cn } from "@/lib/utils";
import { fieldMessage } from "@/lib/utils/fieldMessage";
import { FormField } from "@/components/ui/form-field";

export function BusinessStepForm({
  defaults,
  furthestStep,
}: {
  defaults: BusinessStepInput;
  furthestStep: OnboardingStep;
}) {
  const t = useTranslations("onboarding.business");
  const tShell = useTranslations("onboarding.shell");
  const errMsg = useActionError();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BusinessStepInput>({
    resolver: zodResolver(businessStepSchema),
    defaultValues: defaults,
  });

  const businessTypeValue = useWatch({ control, name: "businessType" });

  const firstNameError = fieldMessage(errors.firstName);
  const lastNameError = fieldMessage(errors.lastName);
  const nameError = fieldMessage(errors.name);
  const businessTypeError = fieldMessage(errors.businessType);
  const businessTypeOtherError = fieldMessage(errors.businessTypeOther);
  const businessTypeErrorId = "business-type-error";

  async function onSubmit(data: BusinessStepInput) {
    if (isStepCompleted("business", furthestStep) && !isDirty) {
      startTransition(() => router.push("/onboarding/workspace"));
      return;
    }

    const result = await businessStepAction(data);
    if (result?.error) {
      toast.error(errMsg(result.error));
      return;
    }
    router.refresh();
    startTransition(() => router.push("/onboarding/workspace"));
  }

  const businessTypes = [
    { value: "photographer", label: t("businessTypes.photographer"), icon: Camera },
    { value: "venue", label: t("businessTypes.venue"), icon: Building2 },
    { value: "planner", label: t("businessTypes.planner"), icon: ClipboardList },
    { value: "stylist", label: t("businessTypes.stylist"), icon: Scissors },
    { value: "catering", label: t("businessTypes.catering"), icon: UtensilsCrossed },
    { value: "entertainer", label: t("businessTypes.entertainer"), icon: Music },
    { value: "artists", label: t("businessTypes.artists"), icon: Palette },
    { value: "other", label: t("businessTypes.other"), icon: Sparkles },
  ] as const;

  return (
    <StepShell
      step="business"
      furthestStep={furthestStep}
      title={t("title")}
      description={t("description")}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            <StepBackButton from="business" />
          </div>
          <Button form="business-step-form" type="submit" variant="brand" disabled={isSubmitting} className="min-w-40">
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
      <form id="business-step-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <FormField id="firstName" label={t("firstName")} error={firstNameError}>
            {({ id, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedby }) => (
              <Input
                id={id}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedby}
                placeholder={t("firstNamePlaceholder")}
                {...register("firstName")}
              />
            )}
          </FormField>
          <FormField
            id="lastName"
            label={
              <>
                {t("lastName")}{" "}
                <span className="font-normal text-muted-foreground">({t("optional")})</span>
              </>
            }
            error={lastNameError}
          >
            {({ id, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedby }) => (
              <Input
                id={id}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedby}
                placeholder={t("lastNamePlaceholder")}
                {...register("lastName")}
              />
            )}
          </FormField>
        </div>

        <FormField id="name" label={t("businessName")} error={nameError}>
          {({ id, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedby }) => (
            <Input
              id={id}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedby}
              placeholder={t("businessNamePlaceholder")}
              {...register("name")}
            />
          )}
        </FormField>

        <div className="flex flex-col gap-1.5">
          <Label id="business-type-label">{t("businessType")}</Label>
          <div
            role="group"
            aria-labelledby="business-type-label"
            aria-describedby={businessTypeError ? businessTypeErrorId : undefined}
            className="grid grid-cols-3 gap-2 sm:grid-cols-4"
          >
            {businessTypes.map((bt) => {
              const Icon = bt.icon;
              const active = businessTypeValue === bt.value;
              return (
                <button
                  key={bt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setValue("businessType", bt.value, { shouldValidate: true, shouldDirty: true })
                  }
                  className={cn(
                    "flex flex-col items-center gap-1.5 border p-3 text-center text-xs font-medium transition-colors",
                    active
                      ? "border-brand bg-brand/12 text-foreground"
                      : "border-border text-muted-foreground hover:border-brand/40"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {bt.label}
                </button>
              );
            })}
          </div>
          {businessTypeError && (
            <p id={businessTypeErrorId} role="alert" className="text-sm text-destructive">
              {businessTypeError}
            </p>
          )}
        </div>

        {businessTypeValue === "other" && (
          <FormField
            id="businessTypeOther"
            label={t("businessTypeOtherLabel")}
            error={businessTypeOtherError}
          >
            {({ id, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedby }) => (
              <Input
                id={id}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedby}
                placeholder={t("businessTypeOtherPlaceholder")}
                {...register("businessTypeOther")}
              />
            )}
          </FormField>
        )}

      </form>
    </StepShell>
  );
}

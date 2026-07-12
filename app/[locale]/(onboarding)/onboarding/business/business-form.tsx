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
    startTransition(() => router.push("/onboarding/workspace"));
  }

  const businessTypes = [
    { value: "photographer", label: t("businessTypes.photographer"), icon: Camera },
    { value: "venue", label: t("businessTypes.venue"), icon: Building2 },
    { value: "planner", label: t("businessTypes.planner"), icon: ClipboardList },
    { value: "stylist", label: t("businessTypes.stylist"), icon: Scissors },
    { value: "catering", label: t("businessTypes.catering"), icon: UtensilsCrossed },
    { value: "entertainer", label: t("businessTypes.entertainer"), icon: Music },
    { value: "other", label: t("businessTypes.other"), icon: Sparkles },
  ] as const;

  return (
    <StepShell
      step="business"
      furthestStep={furthestStep}
      title={t("title")}
      description={t("description")}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col gap-5">
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
          <Input id="name" placeholder={t("businessNamePlaceholder")} {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label id="business-type-label">{t("businessType")}</Label>
          <div
            role="group"
            aria-labelledby="business-type-label"
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
          {errors.businessType && (
            <p className="text-sm text-destructive">{errors.businessType.message}</p>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <StepBackButton from="business" />
          </div>
          <Button type="submit" variant="brand" disabled={isSubmitting} className="min-w-40">
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

"use client";

import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_TYPES, type EventType } from "@/lib/validators/booking";
import {
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "@/lib/validators/workspace";
import type { WizardValues } from "./types";

type Props = {
  control: Control<WizardValues>;
  register: UseFormRegister<WizardValues>;
  watch: UseFormWatch<WizardValues>;
  setValue: UseFormSetValue<WizardValues>;
  errors: FieldErrors<WizardValues>;
  /** Writable teams the user can assign this booking to (create + edit mode). */
  teams?: { id: string; name: string }[];
  /** Wizard mode — team selector only rendered when teams.length > 1. */
  mode?: "create" | "edit";
};

const Asterisk = () => <span className="ml-0.5 text-destructive">*</span>;

function safe(t: (k: string) => string, key: string, fallback: string) {
  try {
    const v = t(key);
    return v && v !== key ? v : fallback;
  } catch {
    return fallback;
  }
}

export function EventPricingStep({
  control,
  register,
  errors,
  teams,
}: Props) {
  const t = useTranslations("app.bookings.wizard.event");
  const tWiz = useTranslations("app.bookings.wizard");
  const tEvent = useTranslations("app.bookings.eventTypes");
  const tPricing = useTranslations("app.bookings.wizard.pricing");

  return (
    <div className="flex flex-col gap-3">
      {/* Title + Event type on one row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label htmlFor="wiz-title">
            {t("title")}
            <Asterisk />
          </Label>
          <Input
            id="wiz-title"
            {...register("title", { required: true })}
            placeholder={t("titlePlaceholder")}
            aria-invalid={errors.title ? "true" : undefined}
          />
          {errors.title ? (
            <p className="text-xs text-destructive">
              {errors.title.message ?? t("titleRequired")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="wiz-eventType">{t("eventType")}</Label>
          <Controller
            control={control}
            name="eventType"
            render={({ field }) => (
              <Select<EventType>
                value={field.value}
                onValueChange={(v) => v && field.onChange(v)}
              >
                <SelectTrigger className="capitalize">
                  <SelectValue placeholder={t("eventType")} />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((e) => (
                    <SelectItem key={e} value={e} className="capitalize">
                      {safe(tEvent, e, e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {/* Team selector — only shown when the caller can choose among >1 writable teams;
          a single team is auto-applied (seeded into teamId), so no field is needed. */}
      {teams && teams.length > 1 ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="wiz-teamId">{tWiz("teamLabel")}</Label>
          <Controller
            control={control}
            name="teamId"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={(v) => v && field.onChange(v)}
              >
                <SelectTrigger id="wiz-teamId">
                  <SelectValue placeholder={tWiz("teamPlaceholder")}>
                    {(value: string) =>
                      teams.find((team) => team.id === value)?.name ??
                      tWiz("teamPlaceholder")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : null}

      {/* Pricing fields */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="wiz-total">{tPricing("total")}</Label>
          <Input
            id="wiz-total"
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            {...register("amount.total", { valueAsNumber: true })}
          />
          {errors.amount?.total ? (
            <p className="text-xs text-destructive">{errors.amount.total.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="wiz-deposit">{tPricing("deposit")}</Label>
          <Input
            id="wiz-deposit"
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            {...register("amount.deposit", { valueAsNumber: true })}
          />
          {errors.amount?.deposit ? (
            <p className="text-xs text-destructive">{errors.amount.deposit.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="wiz-currency">{tPricing("currency")}</Label>
          <Controller
            control={control}
            name="amount.currency"
            render={({ field }) => (
              <Select<SupportedCurrency>
                value={field.value}
                onValueChange={(v) => v && field.onChange(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tPricing("currency")} />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <p className="sm:col-span-3 text-xs text-muted-foreground">
          {tPricing("hint")}
        </p>
      </div>
    </div>
  );
}

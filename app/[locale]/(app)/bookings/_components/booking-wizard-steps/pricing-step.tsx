"use client";

import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
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
import {
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "@/lib/validators/workspace";
import type { WizardValues } from "./types";

type Props = {
  control: Control<WizardValues>;
  register: UseFormRegister<WizardValues>;
  errors: FieldErrors<WizardValues>;
};

export function PricingStep({ control, register, errors }: Props) {
  const t = useTranslations("app.bookings.wizard.pricing");

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="wiz-total">{t("total")}</Label>
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
        <Label htmlFor="wiz-deposit">{t("deposit")}</Label>
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
        <Label htmlFor="wiz-currency">{t("currency")}</Label>
        <Controller
          control={control}
          name="amount.currency"
          render={({ field }) => (
            <Select<SupportedCurrency>
              value={field.value}
              onValueChange={(v) => v && field.onChange(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("currency")} />
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
        {t("hint")}
      </p>
    </div>
  );
}

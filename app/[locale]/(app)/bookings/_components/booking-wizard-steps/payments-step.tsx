"use client";

import { useState } from "react";
import {
  useFieldArray,
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import { useTranslations } from "next-intl";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CollapsibleDrawer } from "@/components/ui/collapsible-drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BOOKING_PAYMENT_STATUSES } from "@/lib/validators/booking";
import {
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "@/lib/validators/workspace";
import { remainingBalance } from "@/lib/bookings/payment-rules";
import type { WizardPaymentStatus, WizardValues } from "./types";

type Props = {
  control: Control<WizardValues>;
  register: UseFormRegister<WizardValues>;
  watch: UseFormWatch<WizardValues>;
  setValue: UseFormSetValue<WizardValues>;
  errors: FieldErrors<WizardValues>;
};

function PaymentCard({
  index,
  control,
  register,
  watch,
  errors,
  onRemove,
  defaultOpen,
}: {
  index: number;
  control: Control<WizardValues>;
  register: UseFormRegister<WizardValues>;
  watch: UseFormWatch<WizardValues>;
  errors: FieldErrors<WizardValues>;
  onRemove: () => void;
  defaultOpen: boolean;
}) {
  const tPayments = useTranslations("app.bookings.payments");
  const [expanded, setExpanded] = useState(defaultOpen);

  const paymentErrors = errors.payments?.[index];
  const allPayments = watch("payments") ?? [];
  const amount = watch("amount");
  const max = remainingBalance(allPayments, amount, index);

  return (
    <CollapsibleDrawer
      title={
        <div onClick={(e) => e.stopPropagation()}>
          <Input
            id={`wiz-payment-title-${index}`}
            {...register(`payments.${index}.title`, {
              required: { value: true, message: tPayments("titleRequired") },
            })}
            placeholder={tPayments("label", { n: index + 1 })}
            aria-invalid={paymentErrors?.title ? "true" : undefined}
            className="h-auto border-none bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
          />
          {paymentErrors?.title?.message ? (
            <p className="text-xs text-destructive">{paymentErrors.title.message}</p>
          ) : null}
        </div>
      }
      actions={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={tPayments("remove")}
        >
          <Trash2Icon className="size-4" />
        </Button>
      }
      open={expanded || !!paymentErrors}
      onOpenChange={setExpanded}
      bodyClassName="grid grid-cols-2 gap-3"
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor={`wiz-payment-price-${index}`}>{tPayments("price")}</Label>
        <Input
          id={`wiz-payment-price-${index}`}
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step="1"
          {...register(`payments.${index}.price`, {
            valueAsNumber: true,
            min: 0,
            max: { value: max, message: tPayments("exceedsBalance") },
            validate: (v) => v > 0 || tPayments("priceRequired"),
          })}
          aria-invalid={paymentErrors?.price ? "true" : undefined}
        />
        {paymentErrors?.price?.message ? (
          <p className="text-xs text-destructive">{paymentErrors.price.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`wiz-payment-status-${index}`}>{tPayments("status")}</Label>
        <Controller
          control={control}
          name={`payments.${index}.status`}
          render={({ field }) => (
            <Select<WizardPaymentStatus>
              value={field.value}
              onValueChange={(v) => v && field.onChange(v)}
            >
              <SelectTrigger id={`wiz-payment-status-${index}`}>
                <SelectValue placeholder={tPayments("status")}>
                  {(v: string) => tPayments(v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BOOKING_PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {tPayments(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </CollapsibleDrawer>
  );
}

export function PaymentsStep({ control, register, watch, errors }: Props) {
  const tPayments = useTranslations("app.bookings.payments");
  const tPricing = useTranslations("app.bookings.wizard.pricing");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "payments",
  });

  function addPayment() {
    append({ price: 0, status: "unpaid", title: "" });
  }

  const paymentsWatched = watch("payments") ?? [];
  const amountWatched = watch("amount");
  const canAddPayment = remainingBalance(paymentsWatched, amountWatched) > 0;

  return (
    <div className="flex flex-col gap-3">
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

      <div className="flex flex-col gap-3">
        {fields.map((field, i) => (
          <PaymentCard
            key={field.id}
            index={i}
            control={control}
            register={register}
            watch={watch}
            errors={errors}
            onRemove={() => remove(i)}
            defaultOpen={i === fields.length - 1}
          />
        ))}
      </div>

      {fields.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-sm text-muted-foreground">{tPayments("empty")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPayment}
            disabled={!canAddPayment}
          >
            <PlusIcon className="size-4" />
            {tPayments("add")}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPayment}
          className="self-start"
          disabled={!canAddPayment}
        >
          <PlusIcon className="size-4" />
          {tPayments("add")}
        </Button>
      )}
    </div>
  );
}

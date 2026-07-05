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
  errors,
  onRemove,
  defaultOpen,
}: {
  index: number;
  control: Control<WizardValues>;
  register: UseFormRegister<WizardValues>;
  errors: FieldErrors<WizardValues>;
  onRemove: () => void;
  defaultOpen: boolean;
}) {
  const tPayments = useTranslations("app.bookings.payments");
  const [expanded, setExpanded] = useState(defaultOpen);

  const paymentErrors = errors.payments?.[index];

  return (
    <CollapsibleDrawer
      title={
        <span className="text-sm font-semibold">
          {tPayments("label", { n: index + 1 })}
        </span>
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
          step="1"
          {...register(`payments.${index}.price`, { valueAsNumber: true, min: 0 })}
          aria-invalid={paymentErrors?.price ? "true" : undefined}
        />
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
                <SelectValue placeholder={tPayments("status")} />
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

export function PaymentsStep({ control, register, errors }: Props) {
  const tPayments = useTranslations("app.bookings.payments");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "payments",
  });

  function addPayment() {
    append({ price: 0, status: "unpaid" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {fields.map((field, i) => (
          <PaymentCard
            key={field.id}
            index={i}
            control={control}
            register={register}
            errors={errors}
            onRemove={() => remove(i)}
            defaultOpen={i === fields.length - 1}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addPayment}
        className="self-start"
      >
        <PlusIcon className="size-4" />
        {tPayments("add")}
      </Button>
    </div>
  );
}

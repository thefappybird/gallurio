import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { PaymentsStep } from "./payments-step";
import type { WizardValues } from "./types";

function Harness({ initialPayments }: { initialPayments?: WizardValues["payments"] } = {}) {
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WizardValues>({
    defaultValues: {
      payments: initialPayments ?? [],
      amount: { total: 0, deposit: 0, currency: "PHP" },
    } as unknown as WizardValues,
  });
  return (
    <PaymentsStep
      control={control}
      register={register}
      watch={watch}
      setValue={setValue}
      errors={errors}
    />
  );
}

describe("PaymentsStep", () => {
  it("renders an Add payment button", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness />
      </NextIntlClientProvider>
    );
    expect(screen.getByRole("button", { name: /add payment/i })).toBeInTheDocument();
  });

  it("renders an editable title input for a payment card", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness initialPayments={[{ price: 100, status: "unpaid", title: "" }]} />
      </NextIntlClientProvider>
    );
    expect(document.getElementById("wiz-payment-title-0")).toBeInTheDocument();
  });

  it("disables the Add payment button once the remaining balance is exhausted", () => {
    function ExhaustedHarness() {
      const {
        control,
        register,
        watch,
        setValue,
        formState: { errors },
      } = useForm<WizardValues>({
        defaultValues: {
          payments: [{ price: 100, status: "unpaid", title: "Deposit" }],
          amount: { total: 100, deposit: 0, currency: "PHP" },
        } as unknown as WizardValues,
      });
      return (
        <PaymentsStep
          control={control}
          register={register}
          watch={watch}
          setValue={setValue}
          errors={errors}
        />
      );
    }
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ExhaustedHarness />
      </NextIntlClientProvider>
    );
    expect(screen.getByRole("button", { name: /add payment/i })).toBeDisabled();
  });

  it("caps a payment card's price input max attribute to its remaining balance", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness
          initialPayments={[
            { price: 20, status: "unpaid", title: "Deposit" },
            { price: 0, status: "unpaid", title: "Final" },
          ]}
        />
      </NextIntlClientProvider>
    );
    const priceInput1 = document.getElementById("wiz-payment-price-1") as HTMLInputElement;
    // amount defaults to { total: 0, deposit: 0 } in the harness, so with a
    // sibling payment of 20 already booked, remaining balance for row 1 is -20.
    expect(priceInput1.max).toBe("-20");
  });
});

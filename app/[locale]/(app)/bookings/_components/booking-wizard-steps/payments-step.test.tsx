import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
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

function ValidationHarness() {
  const {
    control,
    register,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<WizardValues>({
    defaultValues: {
      payments: [{ price: 100, status: "unpaid", title: "" }],
      amount: { total: 100, deposit: 0, currency: "PHP" },
    } as unknown as WizardValues,
  });

  useEffect(() => {
    trigger("payments.0.title");
  }, [trigger]);

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

describe("PaymentsStep title validation", () => {
  it("marks the payment title input invalid and surfaces an alert message when blank", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ValidationHarness />
      </NextIntlClientProvider>
    );

    const input = await screen.findByPlaceholderText(/payment 1/i);
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!);
    expect(message).toHaveAttribute("role", "alert");
    expect(message).toHaveTextContent(/title is required/i);
  });

  it("renders no alert message and no aria-invalid on the title input when filled", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness initialPayments={[{ price: 100, status: "unpaid", title: "Deposit" }]} />
      </NextIntlClientProvider>
    );

    const input = document.getElementById("wiz-payment-title-0");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

function TotalErrorHarness() {
  const {
    control,
    register,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<WizardValues>({
    defaultValues: {
      payments: [],
      amount: { total: -5, deposit: 0, currency: "PHP" },
    } as unknown as WizardValues,
  });

  useEffect(() => {
    setError("amount.total", { message: "Total must be at least 0" });
  }, [setError]);

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

describe("PaymentsStep total amount validation", () => {
  it("marks the total input invalid and surfaces an alert message", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <TotalErrorHarness />
      </NextIntlClientProvider>
    );

    const input = await screen.findByLabelText(/total/i);
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!);
    expect(message).toHaveAttribute("role", "alert");
    expect(message).toHaveTextContent(/total must be at least 0/i);
  });

  it("renders no alert message and no aria-invalid when the amount is valid", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness />
      </NextIntlClientProvider>
    );

    const input = screen.getByLabelText(/total/i);
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

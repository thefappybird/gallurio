import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { PaymentsStep } from "./payments-step";
import type { WizardValues } from "./types";

function Harness() {
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WizardValues>({
    defaultValues: { payments: [] } as unknown as WizardValues,
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
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { EventPricingStep } from "./event-pricing-step";
import type { WizardValues } from "./types";

function Harness({ title }: { title: string }) {
  const {
    control,
    register,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<WizardValues>({
    defaultValues: {
      title,
      eventType: "portrait",
      location: { address: "", lat: null, lng: null },
    } as unknown as WizardValues,
  });

  useEffect(() => {
    trigger("title");
  }, [trigger]);

  return (
    <EventPricingStep
      control={control}
      register={register}
      watch={watch}
      setValue={setValue}
      errors={errors}
    />
  );
}

describe("EventPricingStep title validation", () => {
  it("marks the title input invalid and surfaces an alert message when blank", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness title="" />
      </NextIntlClientProvider>
    );

    const input = await screen.findByPlaceholderText(/carter wedding/i);
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!);
    expect(message).toHaveAttribute("role", "alert");
    expect(message).toHaveTextContent(/give this booking a title/i);
  });

  it("renders no alert message and no aria-invalid when title is filled", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness title="Carter Wedding" />
      </NextIntlClientProvider>
    );

    const input = await screen.findByPlaceholderText(/carter wedding/i);
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { SessionsLocationStep } from "./sessions-location-step";
import type { WizardValues } from "./types";

function Harness({ startDate }: { startDate: string }) {
  const {
    control,
    register,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<WizardValues>({
    defaultValues: {
      sessions: [{ startDate, startTime: "10:00", endTime: "17:00", allowPastDate: false }],
    } as unknown as WizardValues,
  });

  useEffect(() => {
    trigger("sessions.0.startDate");
  }, [trigger]);

  return (
    <SessionsLocationStep
      control={control}
      register={register}
      watch={watch}
      setValue={setValue}
      errors={errors}
      conflictsBySession={[[]]}
      loadingDates={new Set()}
    />
  );
}

describe("SessionsLocationStep startDate validation", () => {
  it("marks the start date input invalid and surfaces an alert message when blank", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness startDate="" />
      </NextIntlClientProvider>
    );

    const input = await screen.findByLabelText(/shift start date/i);
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!);
    expect(message).toHaveAttribute("role", "alert");
    expect(message).toHaveTextContent(/pick a start date/i);
  });

  it("renders no alert message and no aria-invalid when the start date is filled", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Harness startDate="2026-09-01" />
      </NextIntlClientProvider>
    );

    const input = screen.getByLabelText(/shift start date/i);
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

function EndTimeHarness({ startTime, endTime }: { startTime: string; endTime: string }) {
  const {
    control,
    register,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<WizardValues>({
    defaultValues: {
      sessions: [{ startDate: "2026-09-01", startTime, endTime, allowPastDate: false }],
    } as unknown as WizardValues,
  });

  useEffect(() => {
    trigger("sessions.0.endTime");
  }, [trigger]);

  return (
    <SessionsLocationStep
      control={control}
      register={register}
      watch={watch}
      setValue={setValue}
      errors={errors}
      conflictsBySession={[[]]}
      loadingDates={new Set()}
    />
  );
}

describe("SessionsLocationStep endTime validation", () => {
  it("marks the end time input invalid with the endTimeBeforeStart message when it precedes start time", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <EndTimeHarness startTime="17:00" endTime="10:00" />
      </NextIntlClientProvider>
    );

    const input = await screen.findByLabelText(/shift end time/i);
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby");
    const message = document.getElementById(describedBy!);
    expect(message).toHaveAttribute("role", "alert");
    expect(message).toHaveTextContent(/end time must be after start time/i);
  });
});

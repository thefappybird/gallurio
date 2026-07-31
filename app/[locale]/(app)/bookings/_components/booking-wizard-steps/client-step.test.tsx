import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import type { Control, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { bookingClientSchema } from "@/lib/validators/booking";
import { ClientStep } from "./client-step";
import type { WizardValues } from "./types";

// The real modal validates the whole booking form; here we only need the
// `client` slice to reproduce the same error shape ClientStep receives in
// production (errors.client.<field>.message).
const clientOnlySchema = z.object({ client: bookingClientSchema });

function Harness({ client }: { client: WizardValues["client"] }) {
  const {
    control,
    trigger,
    formState: { errors },
  } = useForm<{ client: WizardValues["client"] }>({
    resolver: zodResolver(clientOnlySchema),
    defaultValues: { client },
  });

  useEffect(() => {
    trigger("client");
  }, [trigger]);

  return (
    <ClientStep
      control={control as unknown as Control<WizardValues>}
      errors={errors as unknown as FieldErrors<WizardValues>}
      clients={[]}
    />
  );
}

function renderHarness(client: WizardValues["client"]) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness client={client} />
    </NextIntlClientProvider>
  );
}

describe("ClientStep new-client validation errors", () => {
  it("surfaces an error and marks the email input invalid when the email fails validation", async () => {
    renderHarness({
      mode: "new",
      name: "Jane",
      email: "not-an-email",
      phone: "",
      source: "manual",
      tags: [],
      notes: "",
    });

    const emailError = await screen.findByText(/invalid email/i);
    expect(emailError).toBeInTheDocument();
    expect(document.getElementById("client-new-email")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

  it("surfaces an error and marks the phone input invalid when the phone fails validation", async () => {
    renderHarness({
      mode: "new",
      name: "Jane",
      email: "",
      phone: "12345",
      source: "manual",
      tags: [],
      notes: "",
    });

    const phoneError = await screen.findByText(/invalid phone number/i);
    expect(phoneError).toBeInTheDocument();
    expect(document.getElementById("client-new-phone")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

  it("still surfaces an error and marks the name input invalid when the name is blank", async () => {
    renderHarness({
      mode: "new",
      name: "   ",
      email: "",
      phone: "",
      source: "manual",
      tags: [],
      notes: "",
    });

    const nameError = await screen.findByText(/name is required/i);
    expect(nameError).toBeInTheDocument();
    expect(document.getElementById("client-new-name")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });
});

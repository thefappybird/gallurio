import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useForm } from "react-hook-form";
import type { Control, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { NextIntlClientProvider } from "next-intl";
import { enMessages } from "@/test-utils/messages";
import { bookingClientSchema } from "@/lib/validators/booking";
import { ClientStep, type ClientHit } from "./client-step";
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

function ExistingHarness({
  clients,
  showExistingError,
}: {
  clients: ClientHit[];
  showExistingError: boolean;
}) {
  const { control } = useForm<{ client: WizardValues["client"] }>({
    defaultValues: { client: { mode: "existing", clientId: "", clientName: "" } },
  });

  return (
    <ClientStep
      control={control as unknown as Control<WizardValues>}
      errors={{} as FieldErrors<WizardValues>}
      clients={clients}
      showExistingError={showExistingError}
    />
  );
}

describe("ClientStep existing-client search validation", () => {
  const clients: ClientHit[] = [
    { id: "c1", name: "Jane Doe", email: "jane@example.com", phone: null },
  ];

  it("marks the search input invalid and surfaces an alert message when no existing client is selected", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ExistingHarness clients={clients} showExistingError />
      </NextIntlClientProvider>
    );

    const input = screen.getByPlaceholderText(/search by name or email/i);
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!);
    expect(message).toHaveAttribute("role", "alert");
    expect(message).toHaveTextContent(/pick a client/i);
  });

  it("renders no alert message and no aria-invalid when showExistingError is false", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ExistingHarness clients={clients} showExistingError={false} />
      </NextIntlClientProvider>
    );

    const input = screen.getByPlaceholderText(/search by name or email/i);
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

function ListHarness(props: {
  clients?: ClientHit[];
  clientsLoading?: boolean;
  clientsError?: boolean;
  onRetryClients?: () => void;
}) {
  const { control } = useForm<{ client: WizardValues["client"] }>({
    defaultValues: { client: { mode: "existing", clientId: "", clientName: "" } },
  });
  return (
    <ClientStep
      control={control as unknown as Control<WizardValues>}
      errors={{} as FieldErrors<WizardValues>}
      {...props}
    />
  );
}

function renderList(props: Parameters<typeof ListHarness>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ListHarness {...props} />
    </NextIntlClientProvider>
  );
}

describe("ClientStep existing-client list states", () => {
  it("shows an error with Retry when the client list failed to load", () => {
    const onRetryClients = vi.fn();
    renderList({ clientsError: true, onRetryClients });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load clients.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetryClients).toHaveBeenCalledTimes(1);
  });

  it("shows skeleton rows (no empty state) while the list is loading", () => {
    renderList({ clientsLoading: true });
    expect(screen.getByRole("status", { name: "Loading clients" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("shows the empty state when loaded with no clients, and the search list when populated", () => {
    const { unmount } = renderList({ clients: [] });
    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
    unmount();
    renderList({ clients: [{ id: "c1", name: "Alice", email: null, phone: null }] });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});

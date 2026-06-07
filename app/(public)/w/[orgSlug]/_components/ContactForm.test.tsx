import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContactForm, type InquiryFormLabels } from "./ContactForm";

vi.mock("@/components/ui/phone-input", () => ({
  PhoneInput: ({ value, onChange, ...props }: { value?: string; onChange?: (value?: string) => void }) => (
    <input
      aria-label="Phone"
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value || undefined)}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/location-picker", () => ({
  LocationPicker: ({
    value,
    onChange,
    id,
  }: {
    value: { address: string; lat: number | null; lng: number | null; label?: string | null; placeId?: string | null };
    onChange: (value: {
      address: string;
      lat: number | null;
      lng: number | null;
      label?: string | null;
      placeId?: string | null;
    }) => void;
    id?: string;
  }) => (
    <input
      id={id}
      aria-label="Location"
      value={value.address}
      onChange={(event) =>
        onChange({
          address: event.target.value,
          label: event.target.value,
          placeId: null,
          lat: value.lat,
          lng: value.lng,
        })
      }
    />
  ),
}));

const labels: InquiryFormLabels = {
  tabClient: "Your details",
  tabBooking: "Event details",
  name: "Name",
  email: "Email",
  phone: "Phone",
  preferredContact: "Preferred contact",
  preferred: { email: "Email", phone: "Phone", either: "Either" },
  eventTitle: "Event title",
  sessionsLabel: "Event dates",
  sessionLabel: "Day {n}",
  startDate: "Date",
  startTime: "Start time",
  endTime: "End time",
  addSession: "Add another day",
  removeSession: "Remove",
  shiftHint: "Each day is one shift.",
  eventType: "Event type",
  eventTypes: {
    wedding: "Wedding",
    corporate: "Corporate",
    portrait: "Portrait",
    engagement: "Engagement",
    anniversary: "Anniversary",
    other: "Other",
  },
  location: "Location",
  message: "Tell us more",
  messagePlaceholder: "Details…",
  continue: "Continue",
  submit: "Send inquiry",
  submitting: "Sending…",
  errorGeneric: "Could not submit — please try again later.",
  requiredHint: "Required",
};

function futureDate(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function goToBooking() {
  // base-ui unmounts inactive tab panels, so booking fields only exist once
  // the Event details tab is active.
  fireEvent.click(screen.getByRole("tab", { name: "Event details" }));
}

async function fillValidForm() {
  // Tab 1 (active by default).
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Ada & Charles Wedding" } });
  goToBooking();
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: futureDate() } });
  fireEvent.change(screen.getByLabelText("Location"), {
    target: { value: "Manila, Metro Manila, Philippines" },
  });
  fireEvent.change(screen.getByLabelText("Tell us more"), {
    target: { value: "A lovely garden wedding, two days." },
  });
}

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("ContactForm", () => {
  it("renders both tabs and the honeypot is hidden off-tab-order", () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    expect(screen.getByRole("tab", { name: "Your details" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Event details" })).toBeInTheDocument();

    const honeypot = document.querySelector('input[name="company_name"]') as HTMLInputElement;
    expect(honeypot).toBeTruthy();
    expect(honeypot.getAttribute("aria-hidden")).toBe("true");
    expect(honeypot.tabIndex).toBe(-1);
  });

  it("adds and removes session rows", () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    goToBooking();
    expect(screen.getAllByLabelText("Date")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Add another day/i }));
    expect(screen.getAllByLabelText("Date")).toHaveLength(2);
    // Remove the second row.
    const removeButtons = screen.getAllByRole("button", { name: /^Remove/i });
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    expect(screen.getAllByLabelText("Date")).toHaveLength(1);
  });

  it("submits a normalized payload to /api/inquiries and calls onSuccess", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSuccess = vi.fn();

    render(<ContactForm workspaceSlug="luna-studio" labels={labels} onSuccess={onSuccess} />);
    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/inquiries");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.workspaceSlug).toBe("luna-studio");
    expect(body.email).toBe("ada@example.com");
    expect(body.eventTitle).toBe("Ada & Charles Wedding");
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(body.sessions[0].startDate).toBe(futureDate());
    expect(body.location.address).toBe("Manila, Metro Manila, Philippines");
    expect(body.guestCount).toBeUndefined();
  });

  it("surfaces a recoverable inline error when the API responds non-ok (e.g. 404)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    const onSuccess = vi.fn();

    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={onSuccess} />);
    await fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() =>
      expect(screen.getByText(/could not submit/i)).toBeInTheDocument()
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("blocks duplicate submits while a request is pending", async () => {
    let resolveFetch: (v: { ok: boolean }) => void = () => {};
    global.fetch = vi.fn(
      () => new Promise((res) => { resolveFetch = res; })
    ) as unknown as typeof fetch;

    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    await fillValidForm();
    const submit = screen.getByRole("button", { name: "Send inquiry" });
    fireEvent.click(submit);

    await waitFor(() => expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled());
    resolveFetch({ ok: true });
  });

  it("switches to the booking tab when submit fails validation there", async () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    // Fill Tab 1 validly; leave Tab 2 (date + description) empty.
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Ada & Charles Wedding" } });
    // Booking fields are not mounted while the client tab is active.
    expect(screen.queryByLabelText("Date")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Invalid submit should reveal the booking tab so its errors are visible.
    await waitFor(() => expect(screen.getByLabelText("Date")).toBeInTheDocument());
  });

  it("shows a validation error for an invalid email (rendered as a role=alert on the client tab)", async () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByText(/valid email/i)).toBeInTheDocument());
  });

  it("requires event title before advancing to booking details", async () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByText(/event title/i)).toBeInTheDocument());
    expect(screen.queryByLabelText("Date")).toBeNull();
  });
});

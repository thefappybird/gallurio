import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContactForm, type InquiryFormLabels } from "./ContactForm";

const labels: InquiryFormLabels = {
  tabClient: "Your details",
  tabBooking: "Event details",
  name: "Name",
  email: "Email",
  phone: "Phone",
  preferredContact: "Preferred contact",
  preferred: { email: "Email", phone: "Phone", either: "Either" },
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
  guestCount: "Guests",
  location: "Location",
  message: "Tell us more",
  messagePlaceholder: "Details…",
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

function fillValidForm() {
  // Tab 1 (active by default).
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
  // Tab 2.
  goToBooking();
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: futureDate() } });
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
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/inquiries");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.workspaceSlug).toBe("luna-studio");
    expect(body.email).toBe("ada@example.com");
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(body.sessions[0].startDate).toBe(futureDate());
  });

  it("surfaces a recoverable inline error when the API responds non-ok (e.g. 404)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    const onSuccess = vi.fn();

    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={onSuccess} />);
    fillValidForm();
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
    fillValidForm();
    const submit = screen.getByRole("button", { name: "Send inquiry" });
    fireEvent.click(submit);

    await waitFor(() => expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled());
    resolveFetch({ ok: true });
  });

  it("shows a validation error for an invalid email (rendered as a role=alert on the client tab)", async () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() => expect(screen.getByText(/valid email/i)).toBeInTheDocument());
  });
});

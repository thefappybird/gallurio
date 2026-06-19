import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ContactModal, type ContactModalLabels } from "./ContactModal";

const labels: ContactModalLabels = {
  title: "Get in touch",
  description: "Tell us about your event.",
  close: "Close",
  confirmTitle: "Thanks!",
  confirmBody: "We'll be in touch.",
  confirmClose: "Done",
  form: {
    tabClient: "Your details",
    tabEvent: "Event details",
    tabLocation: "Location & notes",
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
    errorGeneric: "Could not submit.",
    requiredHint: "Required",
    locationRequired: "Please pick a location before submitting.",
    locationPicker: {
      searchPlaceholder: "Search venue or address",
      searching: "Searching",
      noResults: "No matches",
      dragHint: "Drag the pin to fine-tune the exact spot.",
      clear: "Clear location",
    },
  },
};

beforeEach(() => {
  delete window.__gallurioOpenContact;
});

function open() {
  act(() => {
    window.__gallurioOpenContact?.();
  });
}

describe("ContactModal", () => {
  it("registers a global opener and is closed until invoked", () => {
    render(<ContactModal workspaceSlug="luna" labels={labels} />);
    expect(typeof window.__gallurioOpenContact).toBe("function");
    expect(screen.queryByText("Get in touch")).toBeNull();
  });

  it("opens via window.__gallurioOpenContact() and shows the default title/description", async () => {
    render(<ContactModal workspaceSlug="luna" labels={labels} />);
    open();
    await waitFor(() => expect(screen.getByText("Get in touch")).toBeInTheDocument());
    expect(screen.getByText("Tell us about your event.")).toBeInTheDocument();
  });

  it("prefers the workspace's configured contact title/description over the defaults", async () => {
    render(
      <ContactModal
        workspaceSlug="luna"
        labels={labels}
        contact={{ title: "Let's create together", description: "Custom intro copy." }}
      />
    );
    open();
    await waitFor(() => expect(screen.getByText("Let's create together")).toBeInTheDocument());
    expect(screen.getByText("Custom intro copy.")).toBeInTheDocument();
    expect(screen.queryByText("Get in touch")).toBeNull();
  });

  it("renders the fixed form with a hidden honeypot when open", async () => {
    render(<ContactModal workspaceSlug="luna" labels={labels} />);
    open();
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument());
    const honeypot = document.querySelector('input[name="company_name"]') as HTMLInputElement;
    expect(honeypot.getAttribute("aria-hidden")).toBe("true");
  });

  it("closes when the Close button is activated", async () => {
    render(<ContactModal workspaceSlug="luna" labels={labels} />);
    open();
    await waitFor(() => expect(screen.getByText("Get in touch")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Close"));
    await waitFor(() => expect(screen.queryByText("Get in touch")).toBeNull());
  });

  it("closes on Escape", async () => {
    render(<ContactModal workspaceSlug="luna" labels={labels} />);
    open();
    await waitFor(() => expect(screen.getByText("Get in touch")).toBeInTheDocument());
    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByText("Get in touch")).toBeNull());
  });

  it("closes on backdrop click", async () => {
    render(<ContactModal workspaceSlug="luna" labels={labels} />);
    open();
    await waitFor(() => expect(screen.getByText("Get in touch")).toBeInTheDocument());
    const backdrop = document.querySelector("[data-pf-backdrop]") as HTMLElement;
    fireEvent.click(backdrop);
    await waitFor(() => expect(screen.queryByText("Get in touch")).toBeNull());
  });
});

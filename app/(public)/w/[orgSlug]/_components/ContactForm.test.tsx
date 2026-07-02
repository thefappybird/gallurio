import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContactForm, getActiveTabExtraStyle, type InquiryFormLabels } from "./ContactForm";

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
  errorGeneric: "Could not submit — please try again later.",
  requiredHint: "Required",
  locationRequired: "Please pick a location before submitting.",
  locationPicker: {
    searchPlaceholder: "Search venue or address",
    searching: "Searching",
    noResults: "No matches",
    dragHint: "Drag the pin to fine-tune the exact spot.",
    clear: "Clear location",
  },
};

function futureDate(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function goToEventDetails() {
  fireEvent.click(screen.getByRole("tab", { name: "Event details" }));
}

async function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText("Event title");
  fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Ada & Charles Wedding" } });
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: futureDate() } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText("Location");
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
    expect(screen.getByRole("tab", { name: "Location & notes" })).toBeInTheDocument();

    const honeypot = document.querySelector('input[name="company_name"]') as HTMLInputElement;
    expect(honeypot).toBeTruthy();
    expect(honeypot.getAttribute("aria-hidden")).toBe("true");
    expect(honeypot.tabIndex).toBe(-1);
  });

  it("session cards inherit portfolio theme instead of the CRM card tokens", () => {
    // CollapsibleDrawer (shared with the CRM booking wizard) defaults to bg-card
    // text-card-foreground — CRM app-shell tokens. The public contact form must
    // override these so the session card picks up --pf-* brand colors instead.
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    goToEventDetails();
    const sessionCard = screen.getByText("Day 1").closest("section");
    expect(sessionCard).toBeTruthy();
    expect(sessionCard?.className).not.toContain("bg-card");
    expect(sessionCard?.className).not.toContain("text-card-foreground");
  });

  it("adds and removes session rows", () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    goToEventDetails();
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

  it("switches to the event tab when first-step continue fails validation there", async () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    expect(screen.queryByLabelText("Event title")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByLabelText("Event title")).toBeInTheDocument());
  });

  it("advances from event details to location and notes only when the second tab is valid", async () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByLabelText("Event title");
    fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Ada & Charles Wedding" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: futureDate() } });

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByLabelText("Location")).toBeInTheDocument());
    expect(screen.queryByLabelText("Date")).toBeNull();
  });

  it("stays on event details when the second-step continue is invalid", async () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByLabelText("Event title");
    fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Ada & Charles Wedding" } });

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByLabelText("Date")).toBeInTheDocument());
  });

  it("shows a validation error for an invalid email (rendered as a role=alert on the client tab)", async () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByText(/valid email/i)).toBeInTheDocument());
  });

  it("requires event title before advancing to location and notes", async () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByText(/event title/i)).toBeInTheDocument());
    expect(screen.queryByLabelText("Location")).toBeNull();
  });

  it("uses the alternate button appearance for add-another-day controls", () => {
    render(
      <ContactForm
        workspaceSlug="luna"
        labels={labels}
        submitAppearance={{ color: "#111111", style: "solid" }}
        addSessionAppearance={{
          color: "#224466",
          style: "outline",
          textColor: "#224466",
          border: "2px solid #224466",
          borderRadius: "0.5rem",
        }}
        onSuccess={() => {}}
      />
    );

    goToEventDetails();

    const addDay = screen.getByRole("button", { name: /Add another day/i });
    expect(addDay.style.color).toBe("#224466");
    expect(addDay.getAttribute("style")).toContain("border: 2px solid #224466");
    expect(addDay.getAttribute("style")).toContain("border-radius: 0.5rem");
  });

  it("applies a custom error color to validation messages", async () => {
    render(
      <ContactForm
        workspaceSlug="luna"
        labels={labels}
        submitAppearance={{ color: "#111111", style: "solid", errorColor: "#ff3355" }}
        onSuccess={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts[0]).toHaveStyle({ color: "#ff3355" });
  });

  it("applies inactive tab color when tabColor is set in contactConfig", () => {
    render(
      <ContactForm
        workspaceSlug="luna"
        labels={labels}
        contactConfig={{ tabColor: "#334455" }}
        onSuccess={() => {}}
      />
    );
    // All tabs start inactive except "client" (the first active tab).
    // "event" and "location" should get the tabColor style.
    const eventTab = screen.getByRole("tab", { name: "Event details" });
    expect(eventTab.getAttribute("style")).toContain("color: #334455");
  });

  it("applies tabFontSize to all tabs", () => {
    render(
      <ContactForm
        workspaceSlug="luna"
        labels={labels}
        contactConfig={{ tabFontSize: "sm" }}
        onSuccess={() => {}}
      />
    );
    const clientTab = screen.getByRole("tab", { name: "Your details" });
    expect(clientTab.getAttribute("style")).toContain("font-size: 0.8125rem");
  });
  it("blocks submit when no committed location and shows required message", async () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    // Navigate to location tab without setting a location
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByLabelText("Event title");
    fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Ada & Charles Wedding" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: futureDate() } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByLabelText("Location");

    // Fill description so only location is missing
    fireEvent.change(screen.getByLabelText("Tell us more"), {
      target: { value: "A lovely garden wedding, two days." },
    });

    // Attempt submit without committing a location
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() =>
      expect(screen.getByText(/please pick a location/i)).toBeInTheDocument()
    );
  });

  it("allows submit when a committed location exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    const onSuccess = vi.fn();

    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={onSuccess} />);
    await fillValidForm();
    // fillValidForm already sets the Location field value (mocked LocationPicker fires onChange on change)
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});

// ---------------------------------------------------------------------------
// getActiveTabExtraStyle — unit tests
// ---------------------------------------------------------------------------

describe("getActiveTabExtraStyle", () => {
  it("returns default styles when config is null -- underline ON (effective default), scale/highlight off", () => {
    const style = getActiveTabExtraStyle(null);
    expect(style.color).toBe("var(--pf-color-fg)");
    expect(style.transform).toBeUndefined();
    expect(style.backgroundColor).toBeUndefined();
    // Underline effective default = ON: null config means activeTabUnderline is unset, not false
    expect(style.borderBottom).toBe("3px solid var(--pf-color-fg)");
  });

  it("includes transform when activeTabScale is true", () => {
    const style = getActiveTabExtraStyle({ activeTabScale: true });
    expect(style.transform).toBe("scale(1.08)");
    expect((style as Record<string, string>)["fontWeight"]).toBe("700");
  });

  it("does not include transform when activeTabScale is false", () => {
    const style = getActiveTabExtraStyle({ activeTabScale: false });
    expect(style.transform).toBeUndefined();
  });

  it("includes backgroundColor when activeTabHighlight is true", () => {
    const style = getActiveTabExtraStyle({
      activeTabHighlight: true,
      tabHighlightColor: "#ffcc00",
      tabHighlightOpacity: 100,
    });
    expect(style.backgroundColor).toBe("#ffcc00");
  });

  it("mixes color with opacity when tabHighlightOpacity < 100", () => {
    const style = getActiveTabExtraStyle({
      activeTabHighlight: true,
      tabHighlightColor: "#ff0000",
      tabHighlightOpacity: 50,
    });
    expect(style.backgroundColor).toContain("color-mix");
    expect(style.backgroundColor).toContain("50%");
  });

  it("applies activeTabRadius to borderRadius when highlighting", () => {
    const style = getActiveTabExtraStyle({
      activeTabHighlight: true,
      activeTabRadius: "rounded",
    });
    expect(style.borderRadius).toBe("0.5rem");
  });

  it("includes borderBottom when activeTabUnderline is true", () => {
    const style = getActiveTabExtraStyle({
      activeTabUnderline: true,
      tabUnderlineColor: "#0000ff",
    });
    expect(style.borderBottom).toBe("3px solid #0000ff");
  });

  it("uses token resolution for tabUnderlineColor", () => {
    const style = getActiveTabExtraStyle({
      activeTabUnderline: true,
      tabUnderlineColor: "accent",
    });
    expect(style.borderBottom).toContain("var(--pf-color-accent");
  });

  it("does not include borderBottom when activeTabUnderline is false", () => {
    const style = getActiveTabExtraStyle({ activeTabUnderline: false });
    expect(style.borderBottom).toBeUndefined();
  });

  it("uses token resolution for activeTabColor", () => {
    const style = getActiveTabExtraStyle({ activeTabColor: "primary" });
    expect(style.color).toBe("var(--pf-color-primary, var(--pf-color-fg))");
  });

  // C1: 'background' must resolve to --pf-color-bg, NOT --pf-color-background
  it("'background' token → --pf-color-bg (not --pf-color-background)", () => {
    const style = getActiveTabExtraStyle({ activeTabColor: "background" });
    expect(style.color).toContain("--pf-color-bg");
    expect(style.color).not.toContain("--pf-color-background");
  });

  // C1: underline color 'background' → --pf-color-bg, not --pf-color-background
  it("'background' token for underline → --pf-color-bg (not --pf-color-background)", () => {
    const style = getActiveTabExtraStyle({
      activeTabUnderline: true,
      tabUnderlineColor: "background",
    });
    expect(style.borderBottom).toContain("--pf-color-bg");
    expect(style.borderBottom).not.toContain("--pf-color-background");
  });
});

// C3: inactiveTabSubtle effective default = ON
describe("ContactForm — inactive tab Subtle + Compact toggles (C3)", () => {
  it("inactive tabs are dimmed by default when inactiveTabSubtle is unset (effective default ON)", () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    const eventTab = screen.getByRole("tab", { name: "Event details" });
    // Effective default ON → opacity should be < 1 (dimmed)
    const opacity = parseFloat(eventTab.style.opacity ?? "");
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
  });
});

describe("ContactForm — responsive container", () => {
  it("sets container-type: inline-size on the form root for local container queries", () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    const form = document.querySelector("form.pf-contact-form") as HTMLElement;
    expect(form).toBeTruthy();
    expect(form.style.containerType).toBe("inline-size");
  });
});

describe("getActiveTabExtraStyle — underline effective default ON (item 4c)", () => {
  it("includes borderBottom when activeTabUnderline is undefined (effective default ON)", () => {
    const style = getActiveTabExtraStyle({});
    expect(style.borderBottom).toBeDefined();
    expect(style.borderBottom).toContain("var(--pf-color-fg");
  });
});

// ---------------------------------------------------------------------------
// Fix #1 — Active tab full opacity (unambiguous contrast vs dimmed inactive)
// ---------------------------------------------------------------------------

describe("ContactForm — active tab full opacity (fix #1)", () => {
  it("active tab has explicit opacity: 1 even when inactiveTabSubtle is on", () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    const clientTab = screen.getByRole("tab", { name: "Your details" });
    expect(clientTab.style.opacity).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// Item 4a — Inactive tab foreground color effective default
// ---------------------------------------------------------------------------

describe("ContactForm — inactive tab foreground color effective default (item 4a)", () => {
  it("inactive tabs get var(--pf-color-fg) color when tabColor is unset", () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} />);
    const eventTab = screen.getByRole("tab", { name: "Event details" });
    // Effective default: fg color (not empty, prevents inherit-only color in canvas)
    expect(eventTab.style.color).toContain("--pf-color-fg");
  });
});

// ---------------------------------------------------------------------------
// Time-format parity — the public form's time inputs match the workspace
// owner's saved hour-cycle preference (see calendar candles in the app).
// ---------------------------------------------------------------------------

describe("ContactForm — time-format parity", () => {
  it("sets lang=en-US on the time inputs when timeMode is 12h", () => {
    render(<ContactForm workspaceSlug="luna" labels={labels} onSuccess={() => {}} timeMode="12h" />);
    goToEventDetails();
    expect(screen.getByLabelText("Start time")).toHaveAttribute("lang", "en-US");
    expect(screen.getByLabelText("End time")).toHaveAttribute("lang", "en-US");
  });
});

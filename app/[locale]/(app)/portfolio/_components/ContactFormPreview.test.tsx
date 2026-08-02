import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ContactFormPreview } from "./ContactFormPreview";
import { DEFAULT_BRAND_KIT, type PortfolioContactConfig } from "@/lib/page-builder/types";
import type { InquiryFormLabels, SubmitAppearance } from "@/app/(public)/w/[orgSlug]/_components/ContactForm";

const labels: InquiryFormLabels = {
  tabClient: "Client",
  tabEvent: "Event",
  tabLocation: "Location",
  name: "Name",
  email: "Email",
  phone: "Phone",
  preferredContact: "Preferred contact",
  preferred: {
    email: "Email",
    phone: "Phone",
    either: "Either",
  },
  eventTitle: "Event title",
  sessionsLabel: "Sessions",
  sessionLabel: "Session {n}",
  startDate: "Start date",
  startTime: "Start time",
  endTime: "End time",
  addSession: "Add session",
  removeSession: "Remove session",
  shiftHint: "Time ranges are approximate.",
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
  message: "Message",
  messagePlaceholder: "Tell us more",
  continue: "Continue",
  submit: "Send inquiry",
  submitting: "Sending...",
  errorGeneric: "Something went wrong",
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

const submitAppearance: SubmitAppearance = {
  color: "#111111",
  style: "solid",
  textColor: "#ffffff",
  errorColor: "#ff3366",
  borderRadius: "0.5rem",
  border: "2px solid #335577",
};

const addSessionAppearance: SubmitAppearance = {
  color: "#335577",
  style: "outline",
  textColor: "#335577",
  borderRadius: "0.5rem",
  border: "2px solid #335577",
};

const contact: PortfolioContactConfig = {
  title: "Work with us",
  description: "Tell us about your event",
  buttonStyle: "solid",
  buttonColor: "primary",
  backgroundColor: "background",
};

describe("ContactFormPreview", () => {
  it("renders no popup border when the floated border width is 0", () => {
    renderWithProviders(
      <ContactFormPreview
        contact={{}}
        brandKit={DEFAULT_BRAND_KIT}
        labels={labels}
        submitAppearance={submitAppearance}
        addSessionAppearance={addSessionAppearance}
        defaultTitle="Get in touch"
        defaultDescription="Tell us about your event."
      />,
    );
    expect(screen.getByLabelText("Contact form preview").style.borderStyle).toBe("none");
  });
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders the actual inquiry form structure", () => {
    renderWithProviders(
      <ContactFormPreview
        contact={contact}
        brandKit={DEFAULT_BRAND_KIT}
        labels={labels}
        submitAppearance={submitAppearance}
        addSessionAppearance={addSessionAppearance}
        defaultTitle="Default title"
        defaultDescription="Default description"
      />
    );

    expect(screen.getByLabelText("Contact form preview")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Client" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Event" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Location" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("switches tabs and shows the final submit button without submitting", () => {
    renderWithProviders(
      <ContactFormPreview
        contact={contact}
        brandKit={DEFAULT_BRAND_KIT}
        labels={labels}
        submitAppearance={submitAppearance}
        addSessionAppearance={addSessionAppearance}
        defaultTitle="Default title"
        defaultDescription="Default description"
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Location" }));

    expect(screen.getByRole("tabpanel", { name: "Location" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send inquiry" })).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("falls back to the provided title and description", () => {
    renderWithProviders(
      <ContactFormPreview
        contact={{}}
        brandKit={DEFAULT_BRAND_KIT}
        labels={labels}
        submitAppearance={submitAppearance}
        addSessionAppearance={addSessionAppearance}
        defaultTitle="Default title"
        defaultDescription="Default description"
      />
    );

    expect(screen.getByText("Default title")).toBeInTheDocument();
    expect(screen.getByText("Default description")).toBeInTheDocument();
  });

  it("applies popup and button styling with themed fonts", () => {
    renderWithProviders(
      <ContactFormPreview
        contact={{
          ...contact,
          textColor: "#223344",
          backgroundColor: "#f6f1eb",
          popupRadius: "rounded",
          popupBorderWidth: 3,
          popupBorderColor: "#884422",
        }}
        brandKit={DEFAULT_BRAND_KIT}
        labels={labels}
        submitAppearance={submitAppearance}
        addSessionAppearance={addSessionAppearance}
        defaultTitle="Default title"
        defaultDescription="Default description"
      />
    );

    const frame = screen.getByLabelText("Contact form preview");
    expect(frame.style.backgroundColor).toBe("#f6f1eb");
    expect(frame.style.color).toBe("#223344");
    expect(frame.style.borderRadius).toBe("0.5rem");
    expect(frame.style.border).toContain("3px solid #884422");
    expect(frame.style.fontFamily).toBe("var(--pf-font-body)");

    expect(screen.getByText("Work with us").style.fontFamily).toBe("var(--pf-font-heading)");

    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton.style.borderRadius).toBe("0.5rem");
    expect(continueButton.style.border).toContain("2px solid #335577");

    expect(frame.style.maxHeight).toBe("calc(100dvh - 2rem)");
  });

  it("applies the dedicated add-session button appearance", () => {
    renderWithProviders(
      <ContactFormPreview
        contact={contact}
        brandKit={DEFAULT_BRAND_KIT}
        labels={labels}
        submitAppearance={submitAppearance}
        addSessionAppearance={addSessionAppearance}
        defaultTitle="Default title"
        defaultDescription="Default description"
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Event" }));

    const addSession = screen.getByRole("button", { name: /add session/i });
    expect(addSession.style.color).toBe("#335577");
    expect(addSession.getAttribute("style")).toContain("border: 2px solid #335577");
    expect(addSession.getAttribute("style")).toContain("border-radius: 0.5rem");
  });

  it("lets the form itself scroll inside the editor preview surface", () => {
    renderWithProviders(
      <ContactFormPreview
        contact={contact}
        brandKit={DEFAULT_BRAND_KIT}
        labels={labels}
        submitAppearance={submitAppearance}
        addSessionAppearance={addSessionAppearance}
        defaultTitle="Default title"
        defaultDescription="Default description"
      />
    );

    const form = screen.getByRole("button", { name: "Continue" }).closest("form");
    expect(form?.style.overflowY).toBe("auto");
    expect(form?.style.maxHeight).toBe("100%");
  });

  it("passes contactConfig so active tab styling is applied in the editor canvas", () => {
    const configWithTabStyle: PortfolioContactConfig = {
      ...contact,
      activeTabColor: "#cc2200",
    };
    renderWithProviders(
      <ContactFormPreview
        contact={configWithTabStyle}
        brandKit={DEFAULT_BRAND_KIT}
        labels={labels}
        submitAppearance={submitAppearance}
        addSessionAppearance={addSessionAppearance}
        defaultTitle="Default title"
        defaultDescription="Default description"
      />
    );

    // The active tab (Client is default) should have the activeTabColor applied
    const activeTab = screen.getByRole("tab", { name: "Client" });
    expect(activeTab.style.color).toBe("#cc2200");
  });

  it("active tab shows underline by default in preview (fix #3 — canvas==preview==publish parity)", () => {
    renderWithProviders(
      <ContactFormPreview
        contact={{}}
        brandKit={DEFAULT_BRAND_KIT}
        labels={labels}
        submitAppearance={submitAppearance}
        addSessionAppearance={addSessionAppearance}
        defaultTitle="Default title"
        defaultDescription="Default description"
      />
    );

    // Active tab (Client) should have the underline border because activeTabUnderline
    // effective default = ON (undefined !== false). This verifies preview matches public.
    // Use getAttribute("style") — jsdom cannot parse CSS vars inside shorthand properties.
    const activeTab = screen.getByRole("tab", { name: "Client" });
    const styleAttr = activeTab.getAttribute("style") ?? "";
    expect(styleAttr).toContain("border-bottom");
  });

  it("uses filled, disabled sample fields and advances without validating in preview", async () => {
    renderWithProviders(
      <ContactFormPreview
        contact={contact}
        brandKit={DEFAULT_BRAND_KIT}
        labels={labels}
        submitAppearance={submitAppearance}
        addSessionAppearance={addSessionAppearance}
        defaultTitle="Default title"
        defaultDescription="Default description"
      />
    );

    const name = screen.getByLabelText("Name") as HTMLInputElement;
    expect(name).toBeDisabled();
    expect(name.value).toBe("Alex Morgan");
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(await screen.findByText("Required")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByLabelText("Event title")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

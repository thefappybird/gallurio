import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { ContactFormPreview } from "./ContactFormPreview";
import { DEFAULT_BRAND_KIT, type PortfolioContactConfig } from "@/lib/page-builder/types";
import type { InquiryFormLabels, SubmitAppearance } from "@/app/(public)/w/[orgSlug]/_components/ContactForm";

const labels: InquiryFormLabels = {
  tabClient: "Client",
  tabBooking: "Booking",
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
};

const submitAppearance: SubmitAppearance = {
  color: "#111111",
  style: "solid",
  textColor: "#ffffff",
  errorColor: "#ff3366",
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
  it("renders the actual inquiry form structure", () => {
    renderWithProviders(
      <ContactFormPreview
        contact={contact}
        brandKit={DEFAULT_BRAND_KIT}
        labels={labels}
        submitAppearance={submitAppearance}
        defaultTitle="Default title"
        defaultDescription="Default description"
      />
    );

    expect(screen.getByLabelText("Contact form preview")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Client" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Booking" })).toBeInTheDocument();
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
        defaultTitle="Default title"
        defaultDescription="Default description"
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Booking" }));

    expect(screen.getByLabelText("Location")).toBeInTheDocument();
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
});

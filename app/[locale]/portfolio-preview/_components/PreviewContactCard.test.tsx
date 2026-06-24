import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { DEFAULT_BRAND_KIT } from "@/lib/page-builder/types";

// Mock ContactForm to expose which contactConfig it received
vi.mock("@/app/(public)/w/[orgSlug]/_components/ContactForm", () => ({
  ContactForm: ({
    contactConfig,
  }: {
    contactConfig?: { activeTabColor?: string } | null;
  }) => (
    <div data-testid="contact-form">
      <span data-testid="contact-active-tab-color">
        {contactConfig?.activeTabColor ?? "no-tab-color"}
      </span>
    </div>
  ),
}));

import { PreviewBrandShell } from "./PreviewBrandShell";
import { PreviewContactCard } from "./PreviewContactCard";

const SLUG = "studio-contact";
const KEY = `gallurio:portfolio-draft:${SLUG}`;

const LABELS = {
  tabClient: "Client",
  tabEvent: "Event",
  tabLocation: "Location",
  name: "Name",
  email: "Email",
  phone: "Phone",
  preferredContact: "Preferred",
  preferred: { email: "Email", phone: "Phone", whatsapp: "WhatsApp", either: "Either" },
  eventTitle: "Event",
  sessionsLabel: "Sessions",
  sessionLabel: "Session",
  startDate: "Start",
  startTime: "Start time",
  endTime: "End time",
  addSession: "Add",
  removeSession: "Remove",
  shiftHint: "Shift",
  eventType: "Type",
  eventTypes: {
    wedding: "Wedding",
    corporate: "Corporate",
    portrait: "Portrait",
    social: "Social",
    engagement: "Engagement",
    anniversary: "Anniversary",
    other: "Other",
  },
  location: "Location",
  message: "Message",
  messagePlaceholder: "...",
  continue: "Continue",
  submit: "Submit",
  submitting: "Submitting",
  errorGeneric: "Error",
  requiredHint: "Required",
  locationRequired: "Required",
  locationPicker: {
    searchPlaceholder: "Search",
    searching: "Searching",
    noResults: "No results",
    dragHint: "Drag",
    clear: "Clear",
  },
};

const SUBMIT_APPEARANCE = {
  color: "var(--pf-color-primary)",
  style: "solid" as const,
};
const ADD_SESSION_APPEARANCE = {
  color: "var(--pf-color-fg)",
  style: "outline" as const,
};

describe("PreviewContactCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("passes draft contact config to ContactForm when a valid draft is present", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        brandKit: { ...DEFAULT_BRAND_KIT },
        contact: { activeTabColor: "accent" },
      }),
    );

    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName=""
      >
        <PreviewContactCard
          workspaceSlug={SLUG}
          title="Contact"
          labels={LABELS}
          submitAppearance={SUBMIT_APPEARANCE}
          addSessionAppearance={ADD_SESSION_APPEARANCE}
        />
      </PreviewBrandShell>,
    );

    expect(screen.getByTestId("contact-active-tab-color")).toHaveTextContent("accent");
  });

  it("passes null contactConfig to ContactForm when no draft is present", () => {
    render(
      <PreviewBrandShell
        slug={SLUG}
        fallbackCssVars={{}}
        fallbackClassName=""
      >
        <PreviewContactCard
          workspaceSlug={SLUG}
          title="Contact"
          labels={LABELS}
          submitAppearance={SUBMIT_APPEARANCE}
          addSessionAppearance={ADD_SESSION_APPEARANCE}
        />
      </PreviewBrandShell>,
    );

    expect(screen.getByTestId("contact-active-tab-color")).toHaveTextContent("no-tab-color");
  });
});

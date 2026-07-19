import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import React, { useEffect, useCallback, useState } from "react";
import type { ContactModalLabels } from "@/app/(public)/w/[orgSlug]/_components/ContactModal";

// Stub ContactModal: registers the global opener directly and renders a
// sentinel when open (avoids needing Dialog/form deps in unit tests).
vi.mock("@/app/(public)/w/[orgSlug]/_components/ContactModal", () => ({
  ContactModal: ({
    contact,
    labels,
  }: {
    contact?: { title?: string } | null;
    labels: ContactModalLabels;
  }) => {
    const [open, setOpen] = useState(false);
    const openModal = useCallback(() => setOpen(true), []);
    useEffect(() => {
      window.__gallurioOpenContact = openModal;
      return () => {
        if (window.__gallurioOpenContact === openModal) {
          delete window.__gallurioOpenContact;
        }
      };
    }, [openModal]);
    return open ? (
      <div data-testid="contact-modal">{contact?.title ?? labels.title}</div>
    ) : null;
  },
}));

vi.mock("@/lib/page-builder/contactTrigger.client", () => ({
  default: () => null,
}));

import { PreviewBrandShell } from "./PreviewBrandShell";
import { PreviewContactModal } from "./PreviewContactModal";

const SLUG = "studio-preview-contact";

const LABELS: ContactModalLabels = {
  title: "Get in touch",
  description: "Tell us about your event.",
  close: "Close",
  confirmTitle: "Thanks!",
  confirmBody: "We'll be in touch.",
  confirmClose: "Done",
  form: {
    tabClient: "Your details",
    tabEvent: "Event details",
    tabLocation: "Location",
    name: "Name",
    email: "Email",
    phone: "Phone",
    preferredContact: "Preferred",
    preferred: { email: "Email", phone: "Phone", either: "Either" },
    eventTitle: "Event title",
    sessionsLabel: "Dates",
    sessionLabel: "Day {n}",
    startDate: "Date",
    startTime: "Start",
    endTime: "End",
    addSession: "Add day",
    removeSession: "Remove",
    shiftHint: "One shift per day.",
    eventType: "Type",
    eventTypes: {
      wedding: "Wedding",
      corporate: "Corporate",
      portrait: "Portrait",
      engagement: "Engagement",
      anniversary: "Anniversary",
      other: "Other",
    },
    location: "Location",
    message: "Notes",
    messagePlaceholder: "Details…",
    continue: "Continue",
    submit: "Send",
    submitting: "Sending…",
    errorGeneric: "Error",
    requiredHint: "Required",
    locationRequired: "Pick a location.",
    locationPicker: {
      searchPlaceholder: "Search",
      searching: "Searching",
      noResults: "No results",
      dragHint: "Drag pin",
      clear: "Clear",
      changeLocation: "Change",
      accept: "Accept",
      cancel: "Cancel",
      apply: "Apply",
      currentAddressLabel: "Address",
    },
  },
};

const DB_CONTACT = { title: "DB Title" };

describe("PreviewContactModal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.__gallurioOpenContact;
  });

  it("prefers draft contact config title over DB fallback", async () => {
    const KEY = `gallurio:portfolio-draft:${SLUG}`;
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ version: 2, contact: { title: "Draft Title" } }),
    );

    render(
      <PreviewBrandShell slug={SLUG} fallbackCssVars={{}} fallbackClassName="">
        <PreviewContactModal
          workspaceSlug={SLUG}
          dbContact={DB_CONTACT}
          labels={LABELS}
        />
      </PreviewBrandShell>,
    );

    act(() => { window.__gallurioOpenContact?.(); });
    await waitFor(() => expect(screen.getByTestId("contact-modal")).toBeInTheDocument());
    expect(screen.getByTestId("contact-modal")).toHaveTextContent("Draft Title");
  });

  it("registers window.__gallurioOpenContact and opening it shows the modal title", async () => {
    render(
      <PreviewBrandShell slug={SLUG} fallbackCssVars={{}} fallbackClassName="">
        <PreviewContactModal
          workspaceSlug={SLUG}
          dbContact={DB_CONTACT}
          labels={LABELS}
        />
      </PreviewBrandShell>,
    );

    expect(typeof window.__gallurioOpenContact).toBe("function");
    expect(screen.queryByTestId("contact-modal")).toBeNull();

    act(() => { window.__gallurioOpenContact?.(); });
    await waitFor(() => expect(screen.getByTestId("contact-modal")).toBeInTheDocument());
    expect(screen.getByTestId("contact-modal")).toHaveTextContent("DB Title");
  });
});

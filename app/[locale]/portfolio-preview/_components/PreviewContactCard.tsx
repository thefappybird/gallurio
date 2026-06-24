"use client";

import {
  ContactForm,
  type InquiryFormLabels,
  type SubmitAppearance,
} from "@/app/(public)/w/[orgSlug]/_components/ContactForm";
import type { ButtonAppearance } from "@/app/(public)/w/[orgSlug]/_components/contactButtonAppearance";
import {
  resolveAddSessionAppearance,
  resolveSubmitAppearance,
} from "@/app/(public)/w/[orgSlug]/_components/contactButtonAppearance";
import { usePreviewDraft } from "./PreviewDraftContext";

/**
 * Client wrapper so the server preview page can render the (interactive but
 * inert) contact form. `preview` stops submissions from creating a real inquiry,
 * and onSuccess is a required prop on ContactForm, so we supply a no-op here
 * (it's never invoked while preview is on).
 *
 * Reads the unsaved draft contact config from PreviewDraftContext (provided by
 * PreviewBrandShell) and passes it to ContactForm as `contactConfig` so tab
 * styling (getActiveTabExtraStyle) uses the draft values. When a draft contact
 * is present, title/description/button appearances are also re-derived from it
 * so the preview matches the canvas for these fields too.
 */
export function PreviewContactCard({
  workspaceSlug,
  title: fallbackTitle,
  description: fallbackDescription,
  labels,
  submitAppearance: fallbackSubmit,
  addSessionAppearance: fallbackAddSession,
}: {
  workspaceSlug: string;
  title: string;
  description?: string;
  labels: InquiryFormLabels;
  submitAppearance: SubmitAppearance;
  addSessionAppearance: ButtonAppearance;
}) {
  const { contact } = usePreviewDraft();

  // When the draft has a contact config, re-derive the button appearances and
  // text so the contact zone preview matches the unsaved canvas state.
  const title = (contact?.title?.trim()) || fallbackTitle;
  const description = contact ? (contact.description?.trim() || undefined) : fallbackDescription;
  const submitAppearance = contact ? resolveSubmitAppearance(contact) : fallbackSubmit;
  const addSessionAppearance = contact ? resolveAddSessionAppearance(contact) : fallbackAddSession;

  return (
    <div
      style={{
        maxWidth: "32rem",
        margin: "0 auto",
        padding: "2rem 1.25rem",
        fontFamily: "var(--pf-font-body)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--pf-font-heading)",
          fontSize: "1.5rem",
          fontWeight: 700,
          margin: 0,
        }}
      >
        {title}
      </h2>
      {description ? (
        <p style={{ margin: "0.5rem 0 1.25rem", opacity: 0.72 }}>{description}</p>
      ) : (
        <div style={{ height: "1rem" }} />
      )}
      <ContactForm
        preview
        workspaceSlug={workspaceSlug}
        labels={labels}
        submitAppearance={submitAppearance}
        addSessionAppearance={addSessionAppearance}
        contactConfig={contact}
        onSuccess={() => {}}
      />
    </div>
  );
}
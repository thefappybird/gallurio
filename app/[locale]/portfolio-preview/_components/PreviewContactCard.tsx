"use client";

import { ContactForm, type InquiryFormLabels, type SubmitAppearance } from "@/app/(public)/w/[orgSlug]/_components/ContactForm";

/**
 * Client wrapper so the server preview page can render the (interactive but
 * inert) contact form. `preview` stops submissions from creating a real inquiry,
 * and onSuccess is a required prop on ContactForm, so we supply a no-op here
 * (it's never invoked while preview is on).
 */
export function PreviewContactCard({
  workspaceSlug,
  title,
  description,
  labels,
  submitAppearance,
}: {
  workspaceSlug: string;
  title: string;
  description?: string;
  labels: InquiryFormLabels;
  submitAppearance: SubmitAppearance;
}) {
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
        onSuccess={() => {}}
      />
    </div>
  );
}

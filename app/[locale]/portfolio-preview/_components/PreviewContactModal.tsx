"use client";

import { ContactModal, type ContactModalLabels } from "@/app/(public)/w/[orgSlug]/_components/ContactModal";
import ContactTriggerDelegate from "@/lib/page-builder/contactTrigger.client";
import type { PortfolioContactConfig } from "@/lib/page-builder/types";
import { usePreviewDraft } from "./PreviewDraftContext";

/**
 * Mounts ContactModal + ContactTriggerDelegate inside the preview iframe so
 * the navbar Contact button (window.__gallurioOpenContact) works in preview.
 *
 * Reads draft contact config from PreviewDraftContext (set by PreviewBrandShell
 * from localStorage), falling back to the DB-resolved prop. Forwards the
 * resolved brand CSS vars from the same context so the modal popup (portalled
 * to document.body) renders with the correct colours.
 */
export function PreviewContactModal({
  workspaceSlug,
  dbContact,
  labels,
  dir,
}: {
  workspaceSlug: string;
  dbContact: PortfolioContactConfig | null;
  labels: ContactModalLabels;
  /** Effective direction for the portfolio's own language — see ContactModal. */
  dir?: "ltr" | "rtl";
}) {
  const { contact: draftContact, cssVars } = usePreviewDraft();
  const contact = draftContact ?? dbContact;

  return (
    <>
      <ContactTriggerDelegate />
      <ContactModal
        workspaceSlug={workspaceSlug}
        contact={contact}
        labels={labels}
        brandVars={cssVars}
        dir={dir}
      />
    </>
  );
}

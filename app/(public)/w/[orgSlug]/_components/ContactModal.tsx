"use client";

import { useCallback, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { PortfolioContactConfig } from "@/lib/page-builder/types";
import type { TimeMode } from "@/lib/utils/time-format";
import { useGlobalContactTrigger } from "@/lib/hooks/useGlobalContactTrigger";
import { ContactForm, type InquiryFormLabels } from "./ContactForm";
import { resolveAddSessionAppearance, resolveSubmitAppearance, resolveContactColor } from "./contactButtonAppearance";
import { ContactConfirmation } from "./ContactConfirmation";

export type ContactModalLabels = {
  /** Default heading when the workspace hasn't set a custom contact.title. */
  title: string;
  /** Default intro when the workspace hasn't set a custom contact.description. */
  description: string;
  close: string;
  confirmTitle: string;
  confirmBody: string;
  confirmClose: string;
  form: InquiryFormLabels;
};

const CONTACT_RADIUS_MAP: Record<string, string> = {
  sharp: "0",
  subtle: "0.25rem",
  rounded: "0.5rem",
};

function resolvePopupExtraStyles(popupStyle?: string): React.CSSProperties {
  if (popupStyle === "outline") {
    return {
      backgroundColor: "color-mix(in srgb, var(--pf-color-bg, #ffffff) 85%, transparent)",
      border: "2px solid var(--pf-color-fg, #111111)",
    };
  }
  if (popupStyle === "soft") {
    return {
      boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
      border: "none",
    };
  }
  // solid (default): thin border in both themes
  return { border: "1px solid color-mix(in srgb, var(--pf-color-fg, #111111) 14%, transparent)" };
}

export function ContactModal({
  workspaceSlug,
  contact,
  labels,
  brandVars,
  timeMode,
}: {
  workspaceSlug: string;
  contact?: PortfolioContactConfig | null;
  labels: ContactModalLabels;
  /** Brand-kit CSS vars (--pf-color-*, --pf-font-*, --pf-radius). The modal
   *  renders through a Portal at document.body, escaping the page wrapper that
   *  sets these — so we re-apply them here or the popup has no background. */
  brandVars?: Record<string, string>;
  /** Workspace owner's saved time-format preference (see ContactForm). */
  timeMode?: TimeMode;
}) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const openModal = useCallback(() => {
    setSubmitted(false);
    setOpen(true);
  }, []);
  useGlobalContactTrigger(openModal);

  const title = contact?.title?.trim() || labels.title;
  const description = contact?.description?.trim() || labels.description;
  const submitAppearance = resolveSubmitAppearance(contact);
  const addSessionAppearance = resolveAddSessionAppearance(contact);
  const popupExtraStyles = resolvePopupExtraStyles(contact?.popupStyle);
  const popupBorderRadius = contact?.popupRadius
    ? CONTACT_RADIUS_MAP[contact.popupRadius]
    : "var(--pf-radius)";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-pf-backdrop
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        />
        <DialogPrimitive.Popup
          className="pf-contact-popup"
          style={{
            // Re-apply brand vars: the Portal escapes the page wrapper that sets them.
            ...(brandVars as React.CSSProperties),
            position: "fixed",
            zIndex: 101,
            backgroundColor: resolveContactColor(contact?.backgroundColor, "var(--pf-color-bg, #ffffff)"),
            color: resolveContactColor(contact?.textColor, "var(--pf-color-fg, #111111)"),
            fontFamily: "var(--pf-font-body)",
            display: "flex",
            flexDirection: "column",
            outline: "none",
            borderRadius: popupBorderRadius,
            ...popupExtraStyles,
            ...(contact?.popupBorderWidth
              ? { border: `${contact.popupBorderWidth}px solid ${resolveContactColor(contact.popupBorderColor, "var(--pf-color-fg, #111111)")}` }
              : {}),
          }}
        >
          <div
            className="pf-contact-popup-header"
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "1.25rem 1.25rem 0.75rem",
            }}
          >
            <div>
              <DialogPrimitive.Title
                style={{
                  fontFamily: "var(--pf-font-heading)",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description
                  style={{ margin: "0.375rem 0 0", fontSize: "0.9375rem", opacity: 0.72 }}
                >
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label={labels.close}
              className="pf-modal-close"
              style={{
                flexShrink: 0,
                width: "44px",
                height: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                color: "var(--pf-color-fg)",
                border: "none",
                borderRadius: "var(--pf-radius)",
                cursor: "pointer",
                fontSize: "1.25rem",
                lineHeight: 1,
              }}
            >
              <span aria-hidden="true">✕</span>
            </DialogPrimitive.Close>
          </div>

          <div
            className="pf-contact-popup-body"
            style={{ flex: 1, minHeight: 0, padding: "0 1.25rem 1.25rem", overflowY: "auto" }}
          >
            {submitted ? (
              <ContactConfirmation
                title={labels.confirmTitle}
                body={labels.confirmBody}
                closeLabel={labels.confirmClose}
                onClose={() => setOpen(false)}
              />
            ) : (
              <ContactForm
                workspaceSlug={workspaceSlug}
                labels={labels.form}
                submitAppearance={submitAppearance}
                addSessionAppearance={addSessionAppearance}
                contactConfig={contact}
                timeMode={timeMode}
                onSuccess={() => setSubmitted(true)}
              />
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>

      <style>{`
        .pf-modal-close:focus-visible { outline: 2px solid var(--pf-color-accent); outline-offset: 2px; }
        .pf-modal-close:hover { background-color: color-mix(in srgb, var(--pf-color-fg) 8%, transparent); }
        .pf-contact-popup {
          top: 0; left: 0; right: 0; bottom: 0;
          width: 100%; max-height: 100dvh;
        }
        @media (min-width: 640px) {
          .pf-contact-popup {
            top: 50%; left: 50%; right: auto; bottom: auto;
            transform: translate(-50%, -50%);
            width: calc(100% - 2rem); max-width: 32rem;
            max-height: 90dvh;
          }
        }
        @media (max-width: 400px) {
          .pf-contact-popup-header { padding: 1rem 1rem 0.75rem !important; }
          .pf-contact-popup-body { padding: 0 1rem 1rem !important; }
        }
      `}</style>
    </DialogPrimitive.Root>
  );
}
